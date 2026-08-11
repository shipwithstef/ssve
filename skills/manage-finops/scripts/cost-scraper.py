#!/usr/bin/env python3
"""
Cost Scraper - Programmatic cost monitoring and tracking for external services.

This script demonstrates how to scrape and monitor costs from various
external services including cloud providers and LLM services.

Requirements:
    pip install boto3 google-cloud-billing azure-mgmt-costmanagement
    pip install openai anthropic google-generativeai
    pip install selenium beautifulsoup4 requests
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

# Cloud provider imports (optional - install only what you need)
try:
    import boto3
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

try:
    from google.cloud import billing_v1
    from google.oauth2 import service_account
    GCP_AVAILABLE = True
except ImportError:
    GCP_AVAILABLE = False

try:
    from azure.identity import DefaultAzureCredential
    from azure.mgmt.costmanagement import CostManagementClient
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False

# LLM provider imports (optional)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class CostEntry:
    """Represents a cost entry from a service."""
    service: str
    date: str
    amount: float
    currency: str = "USD"
    category: Optional[str] = None
    details: Optional[Dict] = None


class AWSCostScraper:
    """Scrape costs from AWS using Cost Explorer API."""
    
    def __init__(self, region='us-east-1'):
        if not AWS_AVAILABLE:
            raise ImportError("boto3 not installed. Install with: pip install boto3")
        self.client = boto3.client('ce', region_name=region)
    
    def get_costs(self, start_date: str, end_date: str, granularity='DAILY') -> List[CostEntry]:
        """
        Get AWS costs for a date range.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            granularity: 'DAILY', 'MONTHLY', or 'HOURLY'
        
        Returns:
            List of CostEntry objects
        """
        response = self.client.get_cost_and_usage(
            TimePeriod={
                'Start': start_date,
                'End': end_date
            },
            Granularity=granularity,
            Metrics=['BlendedCost'],
            GroupBy=[
                {'Type': 'DIMENSION', 'Key': 'SERVICE'}
            ]
        )
        
        costs = []
        for result in response.get('ResultsByTime', []):
            date = result['TimePeriod']['Start']
            for group in result.get('Groups', []):
                service = group['Keys'][0]
                amount = float(group['Metrics']['BlendedCost']['Amount'])
                
                costs.append(CostEntry(
                    service=f"AWS-{service}",
                    date=date,
                    amount=amount,
                    category=service
                ))
        
        return costs
    
    def get_forecast(self, days=30) -> float:
        """Get AWS cost forecast for next N days."""
        end_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
        start_date = datetime.now().strftime('%Y-%m-%d')
        
        response = self.client.get_cost_forecast(
            TimePeriod={
                'Start': start_date,
                'End': end_date
            },
            Metric='BLENDED_COST',
            Granularity='MONTHLY'
        )
        
        total = 0
        for result in response.get('ForecastResultsByTime', []):
            total += float(result['MeanValue'])
        
        return total


class LLMCostTracker:
    """Track LLM API costs programmatically."""
    
    def __init__(self):
        self.usage_log: List[Dict] = []
        self.pricing = {
            'openai': {
                'gpt-4o': {'input': 2.50, 'output': 5.00},
                'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
                'gpt-3.5-turbo': {'input': 0.30, 'output': 0.60},
                'o3': {'input': 2.00, 'output': 8.00},
                'o3-pro': {'input': 20.00, 'output': 80.00},
            },
            'anthropic': {
                'claude-4-opus': {'input': 15.00, 'output': 75.00},
                'claude-4-sonnet': {'input': 3.00, 'output': 15.00},
                'claude-4-haiku': {'input': 1.00, 'output': 5.00},
            },
            'google': {
                'gemini-2.5-pro': {'input': 1.25, 'output': 10.00},  # ≤200k context
                'gemini-2.5-flash': {'input': 0.075, 'output': 0.30},
                'gemini-1.5-pro': {'input': 0.0781, 'output': 0.3125},
            },
            'deepseek': {
                'deepseek-r1': {'input': 0.55, 'output': 2.19},
            },
        }
    
    def track_request(self, provider: str, model: str, input_tokens: int, 
                     output_tokens: int, context_length: int = 0) -> float:
        """
        Track an LLM API request and calculate cost.
        
        Args:
            provider: Provider name (openai, anthropic, google, deepseek)
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            context_length: Context length (for context-based pricing)
        
        Returns:
            Cost in USD
        """
        if provider not in self.pricing:
            return 0
        
        if model not in self.pricing[provider]:
            return 0
        
        model_pricing = self.pricing[provider][model]
        
        # Handle context-based pricing (e.g., Gemini 2.5 Pro)
        if isinstance(model_pricing['input'], dict):
            input_rate = model_pricing['input'].get(0, 1.25) if context_length <= 200000 else model_pricing['input'].get(200000, 2.50)
            output_rate = model_pricing['output'].get(0, 10.00) if context_length <= 200000 else model_pricing['output'].get(200000, 15.00)
        else:
            input_rate = model_pricing['input']
            output_rate = model_pricing['output']
        
        input_cost = (input_tokens / 1_000_000) * input_rate
        output_cost = (output_tokens / 1_000_000) * output_rate
        total_cost = input_cost + output_cost
        
        entry = {
            'timestamp': datetime.now().isoformat(),
            'provider': provider,
            'model': model,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'context_length': context_length,
            'cost': total_cost
        }
        
        self.usage_log.append(entry)
        return total_cost
    
    def get_costs(self, start_date: Optional[str] = None, 
                  end_date: Optional[str] = None) -> List[CostEntry]:
        """
        Get LLM costs for a date range.
        
        Args:
            start_date: Start date (YYYY-MM-DD) or None for all
            end_date: End date (YYYY-MM-DD) or None for all
        
        Returns:
            List of CostEntry objects
        """
        costs = []
        
        for entry in self.usage_log:
            entry_date = datetime.fromisoformat(entry['timestamp']).date()
            
            if start_date:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                if entry_date < start:
                    continue
            
            if end_date:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                if entry_date > end:
                    continue
            
            costs.append(CostEntry(
                service=f"{entry['provider']}-{entry['model']}",
                date=entry_date.strftime('%Y-%m-%d'),
                amount=entry['cost'],
                category=entry['provider']
            ))
        
        return costs
    
    def get_total_cost(self, start_date: Optional[str] = None,
                      end_date: Optional[str] = None) -> float:
        """Get total LLM costs for a date range."""
        costs = self.get_costs(start_date, end_date)
        return sum(cost.amount for cost in costs)


class CostMonitor:
    """Main cost monitoring class that aggregates costs from multiple sources."""
    
    def __init__(self):
        self.aws_scraper = None
        self.llm_tracker = LLMCostTracker()
        self.custom_costs: List[CostEntry] = []
    
    def setup_aws(self, region='us-east-1'):
        """Set up AWS cost scraper."""
        if AWS_AVAILABLE:
            self.aws_scraper = AWSCostScraper(region)
        else:
            print("Warning: AWS not available. Install boto3 to use AWS cost scraping.")
    
    def add_custom_cost(self, service: str, date: str, amount: float, 
                        category: Optional[str] = None):
        """Add a custom cost entry."""
        self.custom_costs.append(CostEntry(
            service=service,
            date=date,
            amount=amount,
            category=category
        ))
    
    def collect_all_costs(self, start_date: str, end_date: str) -> List[CostEntry]:
        """
        Collect costs from all configured sources.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            List of all CostEntry objects
        """
        all_costs = []
        
        # AWS costs
        if self.aws_scraper:
            try:
                aws_costs = self.aws_scraper.get_costs(start_date, end_date)
                all_costs.extend(aws_costs)
            except Exception as e:
                print(f"Error fetching AWS costs: {e}")
        
        # LLM costs
        llm_costs = self.llm_tracker.get_costs(start_date, end_date)
        all_costs.extend(llm_costs)
        
        # Custom costs
        for cost in self.custom_costs:
            if start_date <= cost.date <= end_date:
                all_costs.append(cost)
        
        return all_costs
    
    def generate_report(self, start_date: str, end_date: str) -> Dict:
        """
        Generate a cost report for a date range.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            Dictionary with cost report
        """
        costs = self.collect_all_costs(start_date, end_date)
        
        total = sum(cost.amount for cost in costs)
        
        # Group by service
        by_service = {}
        for cost in costs:
            if cost.service not in by_service:
                by_service[cost.service] = 0
            by_service[cost.service] += cost.amount
        
        # Group by category
        by_category = {}
        for cost in costs:
            category = cost.category or 'Other'
            if category not in by_category:
                by_category[category] = 0
            by_category[category] += cost.amount
        
        return {
            'period': {
                'start': start_date,
                'end': end_date
            },
            'total': total,
            'by_service': by_service,
            'by_category': by_category,
            'entry_count': len(costs),
            'timestamp': datetime.now().isoformat()
        }
    
    def save_report(self, report: Dict, filename: str):
        """Save cost report to JSON file."""
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"Report saved to {filename}")


def main():
    """Example usage of the cost scraper."""
    print("=" * 60)
    print("Cost Scraper - External Services Cost Monitoring")
    print("=" * 60)
    
    monitor = CostMonitor()
    
    # Set up AWS (if available)
    if AWS_AVAILABLE:
        try:
            monitor.setup_aws()
            print("✓ AWS cost scraper configured")
        except Exception as e:
            print(f"✗ AWS configuration failed: {e}")
    else:
        print("⚠ AWS not available (install boto3)")
    
    # Set up LLM tracking
    print("✓ LLM cost tracker configured")
    
    # Example: Track some LLM usage
    print("\nTracking example LLM usage...")
    monitor.llm_tracker.track_request('openai', 'gpt-4o', 1000, 500)
    monitor.llm_tracker.track_request('google', 'gemini-2.5-flash', 5000, 2000)
    monitor.llm_tracker.track_request('anthropic', 'claude-4-sonnet', 2000, 1000)
    
    # Add custom costs
    today = datetime.now().strftime('%Y-%m-%d')
    monitor.add_custom_cost('Vercel', today, 20.00, 'Hosting')
    monitor.add_custom_cost('Supabase', today, 25.00, 'Database')
    
    # Generate report for last 30 days
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    print(f"\nGenerating cost report for {start_date} to {end_date}...")
    report = monitor.generate_report(start_date, end_date)
    
    print("\n" + "=" * 60)
    print("COST REPORT")
    print("=" * 60)
    print(f"\nTotal Cost: ${report['total']:.2f}")
    print(f"Entries: {report['entry_count']}")
    
    print("\nBy Service:")
    for service, amount in sorted(report['by_service'].items(), 
                                 key=lambda x: x[1], reverse=True):
        print(f"  {service}: ${amount:.2f}")
    
    print("\nBy Category:")
    for category, amount in sorted(report['by_category'].items(),
                                  key=lambda x: x[1], reverse=True):
        print(f"  {category}: ${amount:.2f}")
    
    # Save report
    report_file = f"cost_report_{datetime.now().strftime('%Y%m%d')}.json"
    monitor.save_report(report, report_file)
    
    print("\n" + "=" * 60)
    print("Usage Examples:")
    print("=" * 60)
    print("""
# Track LLM usage
monitor.llm_tracker.track_request('openai', 'gpt-4o', 1000, 500)

# Get AWS costs (requires AWS credentials)
monitor.setup_aws()
aws_costs = monitor.aws_scraper.get_costs('2025-01-01', '2025-01-31')

# Add custom costs
monitor.add_custom_cost('ServiceName', '2025-01-15', 50.00, 'Category')

# Generate report
report = monitor.generate_report('2025-01-01', '2025-01-31')
monitor.save_report(report, 'cost_report.json')
    """)


if __name__ == "__main__":
    main()

