# FinOps Automation Playbook

**Last Updated**: November 2025
**Source**: Industry Best Practices, Automation Patterns, Cloud Provider Documentation

## Table of Contents

1. [Automation Strategy](#automation-strategy)
2. [Cost Monitoring Automation](#cost-monitoring-automation)
3. [Resource Optimization Automation](#resource-optimization-automation)
4. [Budget & Alert Automation](#budget--alert-automation)
5. [Cost Allocation Automation](#cost-allocation-automation)
6. [Waste Elimination Automation](#waste-elimination-automation)
7. [Infrastructure as Code Cost Optimization](#infrastructure-as-code-cost-optimization)
8. [Automation Tools & Scripts](#automation-tools--scripts)

---

## Automation Strategy

### Automation Principles

**1. Start with High-Impact, Low-Risk**
- Automate repetitive, high-value tasks
- Begin with non-production environments
- Validate before production automation

**2. Incremental Automation**
- Start small, scale gradually
- Build on success
- Learn and iterate

**3. Safety First**
- Implement safeguards
- Require approvals for high-risk actions
- Monitor automation results

**4. Document Everything**
- Document automation logic
- Maintain runbooks
- Version control scripts

### Automation Areas

**High Priority**:
1. Cost monitoring and alerting
2. Resource scheduling (non-production)
3. Waste elimination (orphaned resources)
4. Tagging enforcement
5. Budget management

**Medium Priority**:
1. Right-sizing recommendations
2. Reserved Instance management
3. Cost allocation
4. Reporting automation
5. Anomaly detection

**Low Priority**:
1. Advanced optimization
2. Multi-cloud automation
3. Complex workflows
4. Custom integrations

---

## Cost Monitoring Automation

### Automated Cost Collection

**AWS Cost Collection**:
```python
import boto3
from datetime import datetime, timedelta
import json

def collect_daily_costs():
    """
    Collect daily costs from AWS Cost Explorer API.
    """
    ce_client = boto3.client('ce')

    # Get yesterday's costs
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=1)

    response = ce_client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date.strftime('%Y-%m-%d'),
            'End': end_date.strftime('%Y-%m-%d')
        },
        Granularity='DAILY',
        Metrics=['UnblendedCost'],
        GroupBy=[
            {'Type': 'DIMENSION', 'Key': 'SERVICE'},
            {'Type': 'TAG', 'Key': 'Team'}
        ]
    )

    # Store in database or send to monitoring system
    costs = []
    for result in response['ResultsByTime']:
        for group in result['Groups']:
            costs.append({
                'date': result['TimePeriod']['Start'],
                'service': group['Keys'][0],
                'team': group['Keys'][1] if len(group['Keys']) > 1 else 'unallocated',
                'cost': float(group['Metrics']['UnblendedCost']['Amount'])
            })

    return costs

# Schedule with EventBridge/CloudWatch Events
# Run daily at 2 AM UTC
```

**Azure Cost Collection**:
```python
from azure.identity import DefaultAzureCredential
from azure.mgmt.costmanagement import CostManagementClient
from datetime import datetime, timedelta

def collect_daily_costs_azure():
    """
    Collect daily costs from Azure Cost Management API.
    """
    credential = DefaultAzureCredential()
    client = CostManagementClient(credential, subscription_id)

    # Get yesterday's costs
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=1)

    query = {
        'type': 'ActualCost',
        'timeframe': 'Custom',
        'timePeriod': {
            'from': start_date,
            'to': end_date
        },
        'dataset': {
            'granularity': 'Daily',
            'aggregation': {
                'totalCost': {'name': 'PreTaxCost', 'function': 'Sum'}
            },
            'grouping': [
                {'type': 'Dimension', 'name': 'ServiceName'},
                {'type': 'Tag', 'name': 'Team'}
            ]
        }
    }

    result = client.query.usage(
        scope=f'/subscriptions/{subscription_id}',
        parameters=query
    )

    # Process and store results
    costs = []
    for row in result.rows:
        costs.append({
            'date': row[0],
            'service': row[1],
            'team': row[2],
            'cost': row[3]
        })

    return costs
```

**GCP Cost Collection**:
```python
from google.cloud import billing_v1
from datetime import datetime, timedelta

def collect_daily_costs_gcp():
    """
    Collect daily costs from GCP Billing API.
    """
    client = billing_v1.CloudBillingClient()

    # Get yesterday's costs
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=1)

    # Use BigQuery export or Billing API
    # Implementation depends on billing export setup

    return costs
```

### Automated Cost Dashboards

**Real-Time Dashboard Updates**:
```python
def update_cost_dashboard():
    """
    Update cost dashboard with latest data.
    """
    # Collect costs
    costs = collect_daily_costs()

    # Aggregate by team, service, etc.
    aggregated = aggregate_costs(costs)

    # Update dashboard (Grafana, CloudWatch Dashboard, etc.)
    update_dashboard(aggregated)

    # Send to monitoring system
    send_to_monitoring(aggregated)
```

---

## Resource Optimization Automation

### Automated Right-Sizing

**AWS Right-Sizing Automation**:
```python
import boto3

def auto_rightsize_instances():
    """
    Automatically right-size EC2 instances based on utilization.
    """
    ec2 = boto3.client('ec2')
    cloudwatch = boto3.client('cloudwatch')

    # Get all running instances
    instances = ec2.describe_instances(
        Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
    )

    recommendations = []

    for reservation in instances['Reservations']:
        for instance in reservation['Instances']:
            instance_id = instance['InstanceId']
            instance_type = instance['InstanceType']

            # Get CPU and memory utilization (last 7 days)
            cpu_util = get_average_utilization(
                cloudwatch, instance_id, 'CPUUtilization', 7
            )
            memory_util = get_average_utilization(
                cloudwatch, instance_id, 'MemoryUtilization', 7
            )

            # Determine if right-sizing needed
            if cpu_util < 20 and memory_util < 20:
                # Recommend smaller instance
                recommended_type = recommend_smaller_instance(instance_type)
                recommendations.append({
                    'instance_id': instance_id,
                    'current_type': instance_type,
                    'recommended_type': recommended_type,
                    'cpu_util': cpu_util,
                    'memory_util': memory_util,
                    'estimated_savings': calculate_savings(
                        instance_type, recommended_type
                    )
                })

    # Send recommendations (with approval workflow)
    send_recommendations(recommendations)

    return recommendations
```

### Automated Resource Scheduling

**Non-Production Environment Scheduling**:
```python
import boto3
from datetime import datetime

def schedule_non_production_resources():
    """
    Schedule non-production resources to start/stop based on schedule.
    """
    ec2 = boto3.client('ec2')

    # Get current time
    now = datetime.now()
    hour = now.hour
    weekday = now.weekday()  # 0 = Monday, 6 = Sunday

    # Business hours: 8 AM - 6 PM, Monday-Friday
    is_business_hours = (
        weekday < 5 and  # Monday-Friday
        8 <= hour < 18   # 8 AM - 6 PM
    )

    # Get instances tagged for scheduling
    instances = ec2.describe_instances(
        Filters=[
            {'Name': 'tag:Schedule', 'Values': ['true']},
            {'Name': 'tag:Environment', 'Values': ['dev', 'staging', 'test']}
        ]
    )

    for reservation in instances['Reservations']:
        for instance in reservation['Instances']:
            instance_id = instance['InstanceId']
            state = instance['State']['Name']

            if is_business_hours and state == 'stopped':
                # Start instance
                ec2.start_instances(InstanceIds=[instance_id])
                print(f"Started {instance_id}")
            elif not is_business_hours and state == 'running':
                # Stop instance
                ec2.stop_instances(InstanceIds=[instance_id])
                print(f"Stopped {instance_id}")

# Schedule with EventBridge/CloudWatch Events
# Run every hour
```

### Automated Spot Instance Management

**Spot Instance Replacement**:
```python
import boto3

def handle_spot_interruption(event):
    """
    Handle spot instance interruption by replacing with on-demand or another spot.
    """
    ec2 = boto3.client('ec2')

    instance_id = event['detail']['instance-id']

    # Get instance details
    instance = ec2.describe_instances(InstanceIds=[instance_id])['Reservations'][0]['Instances'][0]

    # Launch replacement instance
    # Use same configuration but different instance type if needed
    response = ec2.run_instances(
        ImageId=instance['ImageId'],
        InstanceType=instance['InstanceType'],
        SubnetId=instance['SubnetId'],
        SecurityGroupIds=[sg['GroupId'] for sg in instance['SecurityGroups']],
        InstanceMarketOptions={
            'MarketType': 'spot',
            'SpotOptions': {
                'MaxPrice': '0.10',  # Set max price
                'SpotInstanceType': 'one-time',
                'InstanceInterruptionBehavior': 'terminate'
            }
        },
        TagSpecifications=[{
            'ResourceType': 'instance',
            'Tags': instance['Tags']
        }]
    )

    return response['Instances'][0]['InstanceId']
```

---

## Budget & Alert Automation

### Automated Budget Management

**Budget Creation and Updates**:
```python
import boto3

def create_team_budgets():
    """
    Automatically create budgets for each team.
    """
    budgets = boto3.client('budgets')

    # Get all teams from tags
    teams = get_teams_from_tags()

    for team in teams:
        # Calculate team's historical spend
        historical_spend = get_team_historical_spend(team, months=3)
        avg_monthly = historical_spend / 3

        # Create budget (110% of average)
        budget_amount = avg_monthly * 1.1

        budgets.create_budget(
            AccountId='123456789012',
            Budget={
                'BudgetName': f'{team}-monthly-budget',
                'BudgetLimit': {
                    'Amount': str(budget_amount),
                    'Unit': 'USD'
                },
                'TimeUnit': 'MONTHLY',
                'BudgetType': 'COST',
                'CostFilters': {
                    'TagKeyValue': [
                        f'user:Team${team}'
                    ]
                }
            },
            NotificationsWithSubscribers=[
                {
                    'Notification': {
                        'NotificationType': 'ACTUAL',
                        'ComparisonOperator': 'GREATER_THAN',
                        'Threshold': 80  # Alert at 80% of budget
                    },
                    'Subscribers': [
                        {
                            'SubscriptionType': 'EMAIL',
                            'Address': f'{team}@company.com'
                        }
                    ]
                }
            ]
        )
```

### Automated Alerting

**Cost Anomaly Alerts**:
```python
import boto3
from datetime import datetime, timedelta

def detect_and_alert_anomalies():
    """
    Detect cost anomalies and send alerts.
    """
    ce_client = boto3.client('ce')
    sns = boto3.client('sns')

    # Get last 7 days costs
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=7)

    # Get daily costs
    response = ce_client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date.strftime('%Y-%m-%d'),
            'End': end_date.strftime('%Y-%m-%d')
        },
        Granularity='DAILY',
        Metrics=['UnblendedCost']
    )

    # Calculate baseline (average of first 6 days)
    costs = [
        float(r['Total']['UnblendedCost']['Amount'])
        for r in response['ResultsByTime'][:-1]
    ]
    baseline = sum(costs) / len(costs)
    std_dev = calculate_std_dev(costs)

    # Check today's cost
    today_cost = float(response['ResultsByTime'][-1]['Total']['UnblendedCost']['Amount'])

    # Alert if > 2 standard deviations
    if today_cost > baseline + (2 * std_dev):
        message = f"""
        Cost Anomaly Detected!

        Today's Cost: ${today_cost:.2f}
        Baseline: ${baseline:.2f}
        Standard Deviation: ${std_dev:.2f}

        This is {((today_cost - baseline) / baseline * 100):.1f}% above baseline.
        """

        sns.publish(
            TopicArn='arn:aws:sns:region:account:cost-alerts',
            Message=message,
            Subject='Cost Anomaly Alert'
        )
```

---

## Cost Allocation Automation

### Automated Tagging

**Tag Enforcement and Remediation**:
```python
import boto3

def enforce_tagging_policy():
    """
    Enforce tagging policy and auto-tag resources.
    """
    ec2 = boto3.client('ec2')

    # Required tags
    required_tags = ['Environment', 'Team', 'Project', 'CostCenter']

    # Get all instances
    instances = ec2.describe_instances()

    for reservation in instances['Reservations']:
        for instance in reservation['Instances']:
            instance_id = instance['InstanceId']
            tags = {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}

            # Check for missing tags
            missing_tags = []
            for required_tag in required_tags:
                if required_tag not in tags:
                    missing_tags.append(required_tag)

            if missing_tags:
                # Try to infer tags from other resources or defaults
                inferred_tags = infer_tags(instance)

                # Add missing tags
                tag_list = [
                    {'Key': tag, 'Value': inferred_tags.get(tag, 'unallocated')}
                    for tag in missing_tags
                ]

                ec2.create_tags(
                    Resources=[instance_id],
                    Tags=tag_list
                )

                print(f"Tagged {instance_id} with {missing_tags}")
```

### Automated Cost Allocation

**Cost Allocation by Tags**:
```python
def allocate_costs_by_tags():
    """
    Automatically allocate costs based on tags.
    """
    ce_client = boto3.client('ce')

    # Get costs grouped by tags
    response = ce_client.get_cost_and_usage(
        TimePeriod={
            'Start': '2025-11-01',
            'End': '2025-11-30'
        },
        Granularity='MONTHLY',
        Metrics=['UnblendedCost'],
        GroupBy=[
            {'Type': 'TAG', 'Key': 'Team'},
            {'Type': 'TAG', 'Key': 'Project'},
            {'Type': 'TAG', 'Key': 'Environment'}
        ]
    )

    # Allocate costs
    allocations = []
    for result in response['ResultsByTime']:
        for group in result['Groups']:
            keys = group['Keys']
            cost = float(group['Metrics']['UnblendedCost']['Amount'])

            allocations.append({
                'team': keys[0] if len(keys) > 0 else 'unallocated',
                'project': keys[1] if len(keys) > 1 else 'unallocated',
                'environment': keys[2] if len(keys) > 2 else 'unallocated',
                'cost': cost
            })

    # Store allocations in database
    store_allocations(allocations)

    return allocations
```

---

## Waste Elimination Automation

### Automated Cleanup

**Orphaned Resource Cleanup**:
```python
import boto3
from datetime import datetime, timedelta

def cleanup_orphaned_resources():
    """
    Automatically clean up orphaned resources.
    """
    ec2 = boto3.client('ec2')

    # Find orphaned EBS volumes (not attached to any instance)
    volumes = ec2.describe_volumes(
        Filters=[{'Name': 'status', 'Values': ['available']}]
    )

    orphaned_volumes = []
    for volume in volumes['Volumes']:
        # Check if volume is older than 7 days
        create_time = volume['CreateTime'].replace(tzinfo=None)
        age_days = (datetime.now() - create_time).days

        if age_days > 7:
            # Check if tagged for protection
            tags = {tag['Key']: tag['Value'] for tag in volume.get('Tags', [])}
            if tags.get('Protect', 'false').lower() != 'true':
                orphaned_volumes.append(volume['VolumeId'])

    # Delete orphaned volumes (with approval workflow)
    for volume_id in orphaned_volumes:
        try:
            # Create snapshot first (optional)
            snapshot = ec2.create_snapshot(
                VolumeId=volume_id,
                Description=f'Auto-cleanup snapshot before deletion'
            )

            # Delete volume
            ec2.delete_volume(VolumeId=volume_id)
            print(f"Deleted orphaned volume {volume_id}")
        except Exception as e:
            print(f"Error deleting {volume_id}: {e}")

# Schedule to run weekly
```

**Unused Snapshots Cleanup**:
```python
def cleanup_old_snapshots():
    """
    Clean up old snapshots based on retention policy.
    """
    ec2 = boto3.client('ec2')

    # Get all snapshots
    snapshots = ec2.describe_snapshots(OwnerIds=['self'])

    retention_days = 30  # Keep snapshots for 30 days

    for snapshot in snapshots['Snapshots']:
        start_time = snapshot['StartTime'].replace(tzinfo=None)
        age_days = (datetime.now() - start_time).days

        if age_days > retention_days:
            # Check if tagged for protection
            tags = {tag['Key']: tag['Value'] for tag in snapshot.get('Tags', [])}
            if tags.get('Protect', 'false').lower() != 'true':
                try:
                    ec2.delete_snapshot(SnapshotId=snapshot['SnapshotId'])
                    print(f"Deleted old snapshot {snapshot['SnapshotId']}")
                except Exception as e:
                    print(f"Error deleting snapshot: {e}")
```

---

## Infrastructure as Code Cost Optimization

### Terraform Cost Estimation

**Infracost Integration**:
```bash
#!/bin/bash
# Pre-commit hook to estimate Terraform costs

# Install Infracost if not installed
if ! command -v infracost &> /dev/null; then
    echo "Installing Infracost..."
    # Installation command
fi

# Run Infracost
infracost breakdown --path . --format json > infracost.json

# Check if cost exceeds threshold
total_cost=$(jq '.totalMonthlyCost' infracost.json)
threshold=1000  # $1000/month

if (( $(echo "$total_cost > $threshold" | bc -l) )); then
    echo "WARNING: Estimated monthly cost ($total_cost) exceeds threshold ($threshold)"
    echo "Please review costs before committing."
    exit 1
fi
```

**Terraform Cost Tags**:
```hcl
# Automatically tag all resources with cost allocation tags
locals {
  common_tags = {
    Environment = var.environment
    Team        = var.team
    Project     = var.project
    CostCenter  = var.cost_center
    ManagedBy   = "Terraform"
  }
}

# Apply to all resources
resource "aws_instance" "example" {
  # ... instance configuration ...

  tags = merge(
    local.common_tags,
    {
      Name = "example-instance"
    }
  )
}
```

### CloudFormation Cost Optimization

**Cost-Aware CloudFormation Templates**:
```yaml
# Use parameters for cost optimization
Parameters:
  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues:
      - t3.micro
      - t3.small
      - t3.medium
    Description: Instance type (smaller = lower cost)

  EnableAutoScaling:
    Type: String
    Default: 'false'
    AllowedValues:
      - 'true'
      - 'false'
    Description: Enable auto-scaling for cost optimization

Resources:
  EC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType
      # ... other properties ...
      Tags:
        - Key: Environment
          Value: !Ref Environment
        - Key: Team
          Value: !Ref Team
        - Key: CostCenter
          Value: !Ref CostCenter
```

---

## Automation Tools & Scripts

### Cost Monitoring Script

**Complete Cost Monitoring Script**:
```python
#!/usr/bin/env python3
"""
Comprehensive cost monitoring script.
Collects costs, detects anomalies, sends alerts.
"""

import boto3
from datetime import datetime, timedelta
import json

def monitor_costs():
    """
    Main cost monitoring function.
    """
    ce_client = boto3.client('ce')
    sns = boto3.client('sns')

    # Get costs for last 24 hours
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=1)

    # Collect costs
    costs = collect_costs(ce_client, start_date, end_date)

    # Detect anomalies
    anomalies = detect_anomalies(costs)

    # Check budgets
    budget_alerts = check_budgets()

    # Send alerts if needed
    if anomalies or budget_alerts:
        send_alerts(sns, anomalies, budget_alerts)

    # Update dashboard
    update_dashboard(costs)

    return costs

if __name__ == '__main__':
    monitor_costs()
```

### Resource Optimization Script

**Complete Optimization Script**:
```python
#!/usr/bin/env python3
"""
Comprehensive resource optimization script.
Right-sizes, schedules, and optimizes resources.
"""

import boto3

def optimize_resources():
    """
    Main optimization function.
    """
    # Right-size instances
    right_size_instances()

    # Schedule non-production resources
    schedule_resources()

    # Clean up orphaned resources
    cleanup_orphaned_resources()

    # Optimize storage
    optimize_storage()

    print("Optimization complete!")

if __name__ == '__main__':
    optimize_resources()
```

---

## Best Practices

### Automation Best Practices

1. **Start Small**: Begin with low-risk, high-value automations
2. **Test Thoroughly**: Test in non-production first
3. **Monitor Results**: Track automation effectiveness
4. **Document Everything**: Maintain clear documentation
5. **Version Control**: Use version control for scripts
6. **Error Handling**: Implement robust error handling
7. **Approval Workflows**: Require approval for high-risk actions
8. **Regular Reviews**: Review and update automations regularly

### Safety Practices

1. **Dry Run Mode**: Test without making changes
2. **Gradual Rollout**: Roll out gradually
3. **Rollback Plans**: Have rollback procedures
4. **Monitoring**: Monitor automation execution
5. **Alerts**: Alert on automation failures
6. **Logging**: Log all automation actions
7. **Approvals**: Require approvals for production changes

---

## Conclusion

FinOps automation is essential for scaling cost management and optimization. By automating repetitive tasks, organizations can:

1. **Scale Efficiently**: Manage costs at scale
2. **Reduce Manual Work**: Free up time for strategic work
3. **Improve Consistency**: Consistent cost management
4. **Faster Response**: Quick response to cost issues
5. **Better Visibility**: Real-time cost visibility

Key success factors:
- **Start Small**: Begin with high-impact, low-risk automations
- **Safety First**: Implement safeguards and approvals
- **Monitor Results**: Track automation effectiveness
- **Continuous Improvement**: Regularly review and improve
- **Documentation**: Maintain clear documentation

By following this playbook, organizations can build comprehensive FinOps automation that drives cost optimization and financial accountability.



---

# MCP Tools for FinOps


# MCP Tools for FinOps & Cost Monitoring (2025)

## Overview

Model Context Protocol (MCP) is an open protocol that enables AI assistants like Cursor and Claude to securely interact with external tools, databases, and APIs. This guide covers MCP tools specifically designed for FinOps, cost monitoring, and cloud cost management.

## What is MCP?

### MCP Architecture

**Model Context Protocol (MCP)** is an open-source standard introduced by Anthropic that enables:
- Secure integration between AI models and external systems
- Real-time access to databases, APIs, and tools
- Standardized tool invocation and resource access
- Cross-platform compatibility (Cursor, Claude Desktop, VS Code, etc.)

**Key Components:**
- **MCP Clients**: AI assistants (Cursor, Claude Desktop, Claude Code)
- **MCP Servers**: Tools that provide capabilities (cost APIs, databases, etc.)
- **Tools**: Functions that can be called by the AI
- **Resources**: Data that can be accessed by the AI
- **Prompts**: Reusable prompt templates

## FinOps MCP Servers

### AWS FinOps MCP Server

#### Overview
The AWS FinOps MCP Server enables natural language queries for AWS cost analysis, budget monitoring, and cost optimization recommendations.

#### Installation

**Using npm:**
```bash
npm install -g @aws-finops/mcp-server
```

**Using pip:**
```bash
pip install aws-finops-mcp-server
```

#### Configuration for Cursor

Add to Cursor settings (`~/.cursor/mcp.json` or Cursor Settings > Features > MCP):

```json
{
  "mcpServers": {
    "aws-finops": {
      "command": "npx",
      "args": ["-y", "@aws-finops/mcp-server"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret-key",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

#### Configuration for Claude Desktop

Add to Claude Desktop configuration (`~/.config/claude-desktop/config.json`):

```json
{
  "mcpServers": {
    "aws-finops": {
      "command": "npx",
      "args": ["-y", "@aws-finops/mcp-server"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret-key",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

#### Available Tools

**1. `get_cost_and_usage`**
- Get AWS costs for a date range
- Group by service, region, or tags
- Natural language: "Show me AWS costs for last month grouped by service"

**2. `get_cost_forecast`**
- Forecast future costs
- Natural language: "Forecast AWS costs for next 3 months"

**3. `get_budget_status`**
- Check budget status and alerts
- Natural language: "Show me all budgets that are over 80% used"

**4. `get_cost_anomalies`**
- Detect cost anomalies
- Natural language: "Find cost anomalies in the last 30 days"

**5. `get_rightsizing_recommendations`**
- Get right-sizing recommendations
- Natural language: "Show me EC2 instances that can be downsized"

**6. `get_reserved_instance_recommendations`**
- Get RI purchase recommendations
- Natural language: "What Reserved Instances should I buy?"

**7. `get_unused_resources`**
- Find unused or idle resources
- Natural language: "Find unused EC2 instances older than 30 days"

#### Example Usage

```
User: "What are my AWS costs for last month?"

Claude (using MCP):
- Calls get_cost_and_usage with last month's date range
- Groups by service
- Returns formatted cost breakdown

User: "Should I buy Reserved Instances?"

Claude (using MCP):
- Calls get_reserved_instance_recommendations
- Analyzes usage patterns
- Provides recommendations with ROI calculations
```

### Azure FinOps MCP Server

#### Overview
Azure FinOps MCP Server provides natural language access to Azure cost management and billing APIs.

#### Installation

```bash
pip install azure-finops-mcp-server
```

#### Configuration

```json
{
  "mcpServers": {
    "azure-finops": {
      "command": "python",
      "args": ["-m", "azure_finops_mcp_server"],
      "env": {
        "AZURE_CLIENT_ID": "your-client-id",
        "AZURE_CLIENT_SECRET": "your-client-secret",
        "AZURE_TENANT_ID": "your-tenant-id",
        "AZURE_SUBSCRIPTION_ID": "your-subscription-id"
      }
    }
  }
}
```

#### Available Tools

**1. `get_azure_costs`**
- Get Azure costs for date range
- Natural language: "Show Azure costs grouped by resource group"

**2. `get_azure_budgets`**
- Check Azure budget status
- Natural language: "Which budgets are over 80%?"

**3. `get_cost_optimization_recommendations`**
- Get Azure cost optimization tips
- Natural language: "How can I reduce Azure costs?"

**4. `get_reserved_capacity_recommendations`**
- Get Reserved Capacity recommendations
- Natural language: "Should I buy Azure Reserved Instances?"

### Google Cloud FinOps MCP Server

#### Overview
Google Cloud FinOps MCP Server enables cost analysis for GCP resources.

#### Installation

```bash
pip install gcp-finops-mcp-server
```

#### Configuration

```json
{
  "mcpServers": {
    "gcp-finops": {
      "command": "python",
      "args": ["-m", "gcp_finops_mcp_server"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "GCP_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

#### Available Tools

**1. `get_gcp_costs`**
- Get GCP costs for date range
- Natural language: "Show GCP costs for last month"

**2. `get_committed_use_recommendations`**
- Get Committed Use Discount recommendations
- Natural language: "Should I commit to GCP usage?"

### Multi-Cloud FinOps MCP Server

#### Overview
A unified MCP server that aggregates costs from AWS, Azure, and GCP.

#### Installation

```bash
pip install multicloud-finops-mcp-server
```

#### Configuration

```json
{
  "mcpServers": {
    "multicloud-finops": {
      "command": "python",
      "args": ["-m", "multicloud_finops_mcp_server"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-aws-key",
        "AWS_SECRET_ACCESS_KEY": "your-aws-secret",
        "AZURE_CLIENT_ID": "your-azure-client-id",
        "AZURE_CLIENT_SECRET": "your-azure-secret",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gcp-credentials.json"
      }
    }
  }
}
```

#### Available Tools

**1. `get_all_cloud_costs`**
- Aggregate costs from all cloud providers
- Natural language: "Show me total costs across AWS, Azure, and GCP"

**2. `compare_cloud_costs`**
- Compare costs across providers
- Natural language: "Compare compute costs across AWS, Azure, and GCP"

**3. `get_unified_budget_status`**
- Check budgets across all clouds
- Natural language: "Show me all budgets across all cloud providers"

## LLM Cost Monitoring MCP Servers

### OpenAI Cost Tracker MCP Server

#### Overview
Tracks OpenAI API usage and costs in real-time.

#### Installation

```bash
pip install openai-cost-tracker-mcp-server
```

#### Configuration

```json
{
  "mcpServers": {
    "openai-cost-tracker": {
      "command": "python",
      "args": ["-m", "openai_cost_tracker_mcp_server"],
      "env": {
        "OPENAI_API_KEY": "your-api-key",
        "DATABASE_URL": "sqlite:///costs.db"
      }
    }
  }
}
```

#### Available Tools

**1. `track_openai_request`**
- Track individual API requests
- Records model, tokens, and cost

**2. `get_openai_costs`**
- Get costs for date range
- Natural language: "How much did I spend on OpenAI this month?"

**3. `get_openai_usage_by_model`**
- Get usage breakdown by model
- Natural language: "Which OpenAI models am I using most?"

**4. `estimate_openai_cost`**
- Estimate cost before making request
- Natural language: "How much would 1000 GPT-4o requests cost?"

### Anthropic Cost Tracker MCP Server

#### Overview
Tracks Anthropic Claude API usage and costs.

#### Installation

```bash
pip install anthropic-cost-tracker-mcp-server
```

#### Configuration

```json
{
  "mcpServers": {
    "anthropic-cost-tracker": {
      "command": "python",
      "args": ["-m", "anthropic_cost_tracker_mcp_server"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key",
        "DATABASE_URL": "sqlite:///costs.db"
      }
    }
  }
}
```

### Unified LLM Cost Tracker MCP Server

#### Overview
Tracks costs across multiple LLM providers (OpenAI, Anthropic, Google, etc.)

#### Installation

```bash
pip install llm-cost-tracker-mcp-server
```

#### Configuration

```json
{
  "mcpServers": {
    "llm-cost-tracker": {
      "command": "python",
      "args": ["-m", "llm_cost_tracker_mcp_server"],
      "env": {
        "OPENAI_API_KEY": "your-openai-key",
        "ANTHROPIC_API_KEY": "your-anthropic-key",
        "GOOGLE_API_KEY": "your-google-key",
        "DATABASE_URL": "sqlite:///llm_costs.db"
      }
    }
  }
}
```

#### Available Tools

**1. `track_llm_request`**
- Track request across any provider
- Natural language: "Track this GPT-4o request"

**2. `get_total_llm_costs`**
- Get total costs across all providers
- Natural language: "What's my total LLM spending this month?"

**3. `compare_llm_providers`**
- Compare costs across providers
- Natural language: "Compare costs of GPT-4o vs Claude Sonnet"

**4. `get_cost_breakdown`**
- Get detailed cost breakdown
- Natural language: "Break down my LLM costs by provider and model"

## Building Custom FinOps MCP Servers

### Python MCP Server Template

#### Basic Structure

```python
#!/usr/bin/env python3
"""
Custom FinOps MCP Server
"""

import asyncio
import json
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from mcp.server import Server
from mcp.server.models import InitializationOptions
import mcp.server.stdio
import mcp.types as types

# Initialize MCP server
server = Server("custom-finops-mcp")

@server.list_tools()
async def list_tools() -> List[types.Tool]:
    """List available tools"""
    return [
        types.Tool(
            name="get_costs",
            description="Get costs for a date range",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date (YYYY-MM-DD)"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date (YYYY-MM-DD)"
                    },
                    "group_by": {
                        "type": "string",
                        "enum": ["service", "region", "tag"],
                        "description": "Group costs by"
                    }
                },
                "required": ["start_date", "end_date"]
            }
        ),
        types.Tool(
            name="get_budget_status",
            description="Get budget status",
            inputSchema={
                "type": "object",
                "properties": {
                    "budget_name": {
                        "type": "string",
                        "description": "Budget name"
                    }
                }
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle tool calls"""
    if name == "get_costs":
        start_date = arguments.get("start_date")
        end_date = arguments.get("end_date")
        group_by = arguments.get("group_by", "service")

        # Your cost retrieval logic here
        costs = await get_costs_from_api(start_date, end_date, group_by)

        return [
            types.TextContent(
                type="text",
                text=json.dumps(costs, indent=2)
            )
        ]

    elif name == "get_budget_status":
        budget_name = arguments.get("budget_name")

        # Your budget status logic here
        status = await get_budget_status(budget_name)

        return [
            types.TextContent(
                type="text",
                text=json.dumps(status, indent=2)
            )
        ]

    else:
        raise ValueError(f"Unknown tool: {name}")

async def get_costs_from_api(start_date: str, end_date: str, group_by: str):
    """Retrieve costs from your API"""
    # Implement your cost retrieval logic
    pass

async def get_budget_status(budget_name: str):
    """Retrieve budget status"""
    # Implement your budget status logic
    pass

async def main():
    """Main entry point"""
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="custom-finops-mcp",
                server_version="1.0.0",
                capabilities=server.get_capabilities()
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
```

### TypeScript/Node.js MCP Server Template

#### Basic Structure

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Initialize server
const server = new Server(
  {
    name: "custom-finops-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_costs",
        description: "Get costs for a date range",
        inputSchema: {
          type: "object",
          properties: {
            start_date: {
              type: "string",
              description: "Start date (YYYY-MM-DD)",
            },
            end_date: {
              type: "string",
              description: "End date (YYYY-MM-DD)",
            },
            group_by: {
              type: "string",
              enum: ["service", "region", "tag"],
              description: "Group costs by",
            },
          },
          required: ["start_date", "end_date"],
        },
      },
      {
        name: "get_budget_status",
        description: "Get budget status",
        inputSchema: {
          type: "object",
          properties: {
            budget_name: {
              type: "string",
              description: "Budget name",
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_costs") {
    const startDate = args.start_date as string;
    const endDate = args.end_date as string;
    const groupBy = args.group_by as string || "service";

    // Your cost retrieval logic here
    const costs = await getCostsFromAPI(startDate, endDate, groupBy);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(costs, null, 2),
        },
      ],
    };
  }

  if (name === "get_budget_status") {
    const budgetName = args.budget_name as string;

    // Your budget status logic here
    const status = await getBudgetStatus(budgetName);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function getCostsFromAPI(
  startDate: string,
  endDate: string,
  groupBy: string
): Promise<any> {
  // Implement your cost retrieval logic
}

async function getBudgetStatus(budgetName: string): Promise<any> {
  // Implement your budget status logic
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Custom FinOps MCP server running on stdio");
}

main().catch(console.error);
```

## Advanced MCP Patterns for FinOps

### Cost Alerting MCP Server

#### Implementation

```python
@server.list_tools()
async def list_tools() -> List[types.Tool]:
    return [
        types.Tool(
            name="set_cost_alert",
            description="Set up cost alert",
            inputSchema={
                "type": "object",
                "properties": {
                    "threshold": {"type": "number"},
                    "service": {"type": "string"},
                    "notification_channel": {"type": "string"}
                },
                "required": ["threshold"]
            }
        ),
        types.Tool(
            name="check_cost_alerts",
            description="Check if any alerts are triggered",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        )
    ]
```

### Cost Optimization MCP Server

#### Implementation

```python
@server.list_tools()
async def list_tools() -> List[types.Tool]:
    return [
        types.Tool(
            name="get_optimization_recommendations",
            description="Get cost optimization recommendations",
            inputSchema={
                "type": "object",
                "properties": {
                    "service": {"type": "string"},
                    "region": {"type": "string"}
                }
            }
        ),
        types.Tool(
            name="apply_optimization",
            description="Apply optimization recommendation",
            inputSchema={
                "type": "object",
                "properties": {
                    "recommendation_id": {"type": "string"},
                    "confirm": {"type": "boolean"}
                },
                "required": ["recommendation_id", "confirm"]
            }
        )
    ]
```

## MCP Resources for FinOps

### Cost Data Resources

#### Definition

```python
@server.list_resources()
async def list_resources() -> List[types.Resource]:
    return [
        types.Resource(
            uri="costs://monthly-summary",
            name="Monthly Cost Summary",
            description="Current month's cost summary",
            mimeType="application/json"
        ),
        types.Resource(
            uri="costs://budgets",
            name="Budget Status",
            description="All budget statuses",
            mimeType="application/json"
        )
    ]

@server.read_resource()
async def read_resource(uri: str) -> str:
    if uri == "costs://monthly-summary":
        costs = await get_monthly_costs()
        return json.dumps(costs)
    elif uri == "costs://budgets":
        budgets = await get_all_budgets()
        return json.dumps(budgets)
    else:
        raise ValueError(f"Unknown resource: {uri}")
```

## Best Practices

### Security

1. **Credential Management**
   - Never hardcode credentials in MCP server code
   - Use environment variables or secure credential stores
   - Rotate credentials regularly

2. **Access Control**
   - Implement least-privilege access
   - Use IAM roles and service accounts
   - Audit MCP tool usage

3. **Data Privacy**
   - Don't expose sensitive cost data unnecessarily
   - Implement data masking for sensitive information
   - Comply with data protection regulations

### Performance

1. **Caching**
   - Cache frequently accessed cost data
   - Set appropriate TTLs
   - Invalidate cache on updates

2. **Rate Limiting**
   - Implement rate limiting for API calls
   - Use exponential backoff for retries
   - Monitor API usage

3. **Async Operations**
   - Use async/await for I/O operations
   - Don't block the event loop
   - Handle timeouts gracefully

### Error Handling

```python
@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
    try:
        # Your tool logic
        result = await execute_tool(name, arguments)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except ValueError as e:
        return [types.TextContent(
            type="text",
            text=f"Error: {str(e)}"
        )]
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return [types.TextContent(
            type="text",
            text=f"Internal error: {str(e)}"
        )]
```

## Troubleshooting

### Common Issues

**1. MCP Server Not Loading**
- Check configuration file syntax (valid JSON)
- Verify command path is correct
- Check environment variables are set
- Restart Cursor/Claude Desktop

**2. Tools Not Available**
- Verify server is running
- Check server logs for errors
- Ensure tools are properly registered
- Check MCP server version compatibility

**3. Authentication Errors**
- Verify credentials are correct
- Check IAM permissions
- Ensure credentials haven't expired
- Test API access outside MCP

**4. Performance Issues**
- Check API rate limits
- Implement caching
- Optimize database queries
- Use async operations

## Integration Examples

### Cost Monitoring Workflow

```
User: "Monitor my AWS costs and alert me if they exceed $1000"

Claude (using MCP):
1. Calls get_cost_and_usage to get current costs
2. Checks if costs exceed threshold
3. If yes, calls set_cost_alert to create alert
4. Returns summary and alert status
```

### Cost Optimization Workflow

```
User: "How can I reduce my cloud costs?"

Claude (using MCP):
1. Calls get_costs to analyze current spending
2. Calls get_rightsizing_recommendations
3. Calls get_unused_resources
4. Calls get_reserved_instance_recommendations
5. Aggregates recommendations
6. Returns prioritized optimization suggestions
```

## Resources & References

### Official Documentation
- **MCP Specification**: https://modelcontextprotocol.io
- **Anthropic MCP Docs**: https://docs.anthropic.com/mcp
- **Cursor MCP Guide**: https://docs.cursor.com/mcp
- **Claude Desktop MCP**: https://claude.ai/docs/mcp

### FinOps MCP Servers
- **AWS FinOps MCP**: https://github.com/aws/aws-finops-mcp-server
- **Azure FinOps MCP**: https://pypi.org/project/azure-finops-mcp-server/
- **Vantage MCP**: https://www.vantage.sh/docs/mcp

### Community Resources
- **MCP Playground**: https://mcp.playgrounds.ai
- **MCP Directory**: https://mcp.directory
- **MCP Examples**: https://github.com/modelcontextprotocol/servers

## Quick Reference: Common MCP Queries

### Cost Queries
```
"What are my AWS costs for last month?"
"Show me costs grouped by service"
"Compare costs across AWS, Azure, and GCP"
"What's my total cloud spending this month?"
```

### Budget Queries
```
"Show me all budgets over 80% used"
"Create a monthly budget of $1000 for AWS"
"What's the status of my production budget?"
```

### Optimization Queries
```
"How can I reduce my cloud costs?"
"Show me unused EC2 instances"
"Should I buy Reserved Instances?"
"What are my right-sizing opportunities?"
```

### LLM Cost Queries
```
"How much did I spend on OpenAI this month?"
"Estimate the cost of 1000 GPT-4o requests"
"Compare costs of GPT-4o vs Claude Sonnet"
"Track this LLM request"
```

## Troubleshooting MCP Issues

### Server Not Loading
1. Check JSON syntax in configuration file
2. Verify command path is absolute or in PATH
3. Check environment variables are set correctly
4. Review server logs for errors
5. Restart Cursor/Claude Desktop

### Tools Not Available
1. Verify server is running: Check process list
2. Test server manually: Run server command directly
3. Check server version compatibility
4. Verify tool registration in server code
5. Check MCP client version

### Authentication Errors
1. Verify credentials are correct
2. Check IAM permissions for cloud APIs
3. Ensure credentials haven't expired
4. Test API access outside MCP
5. Use service accounts instead of user credentials

### Performance Issues
1. Implement caching for frequently accessed data
2. Check API rate limits
3. Use async operations
4. Optimize database queries
5. Monitor server resource usage

## Next Steps

1. **Choose MCP Servers**: Select FinOps MCP servers for your cloud providers
2. **Configure**: Set up MCP servers in Cursor or Claude Desktop
3. **Test**: Verify tools are working with simple queries
4. **Build Custom**: Create custom MCP servers for your specific needs
5. **Integrate**: Integrate MCP tools into your FinOps workflows
6. **Monitor**: Track MCP tool usage and costs
7. **Optimize**: Continuously improve MCP server performance
8. **Extend**: Add custom tools for your specific use cases
9. **Share**: Contribute MCP servers to the community
10. **Document**: Document your MCP server tools and usage patterns



---

# External Services Cost Scraping


# External Services Cost & Credits Scraping Guide (2025)

## Overview

Comprehensive guide to programmatically monitoring, scraping, and tracking costs and credits across external services including cloud providers, LLM services, and SaaS platforms.

## Purpose

This guide provides techniques, tools, and best practices for:
- Automating cost data collection from external services
- Monitoring credit balances and usage
- Tracking spending patterns and anomalies
- Building cost monitoring dashboards
- Implementing cost alerts and budget controls

## Cloud Provider Cost APIs

### AWS Cost Explorer API

#### Setup
```python
import boto3
from datetime import datetime, timedelta

# Initialize Cost Explorer client
ce_client = boto3.client('ce', region_name='us-east-1')
```

#### Get Cost and Usage Data
```python
def get_aws_costs(start_date, end_date, granularity='DAILY'):
    """
    Retrieve AWS costs for a date range

    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        granularity: 'DAILY', 'MONTHLY', or 'HOURLY'

    Returns:
        Cost and usage data
    """
    response = ce_client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date,
            'End': end_date
        },
        Granularity=granularity,
        Metrics=['BlendedCost', 'UnblendedCost', 'UsageQuantity'],
        GroupBy=[
            {'Type': 'DIMENSION', 'Key': 'SERVICE'},
            {'Type': 'DIMENSION', 'Key': 'REGION'}
        ]
    )
    return response
```

#### Get Forecasted Costs
```python
def get_aws_forecast():
    """Get AWS cost forecast for next 12 months"""
    end_date = datetime.now() + timedelta(days=365)
    start_date = datetime.now()

    response = ce_client.get_cost_forecast(
        TimePeriod={
            'Start': start_date.strftime('%Y-%m-%d'),
            'End': end_date.strftime('%Y-%m-%d')
        },
        Metric='BLENDED_COST',
        Granularity='MONTHLY'
    )
    return response
```

#### Get Reserved Instance Recommendations
```python
def get_ri_recommendations():
    """Get Reserved Instance recommendations"""
    response = ce_client.get_reservation_coverage(
        TimePeriod={
            'Start': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
            'End': datetime.now().strftime('%Y-%m-%d')
        },
        Granularity='DAILY',
        Metrics=['CoverageHoursPercentage']
    )
    return response
```

#### Get Cost Anomalies
```python
def get_cost_anomalies():
    """Detect cost anomalies"""
    response = ce_client.get_anomalies(
        DateInterval={
            'Start': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
            'End': datetime.now().strftime('%Y-%m-%d')
        },
        MonitorArn='arn:aws:ce::account-id:anomalymonitor/monitor-id'
    )
    return response
```

### Google Cloud Billing API

#### Setup
```python
from google.cloud import billing_v1
from google.oauth2 import service_account

# Initialize billing client
credentials = service_account.Credentials.from_service_account_file(
    'path/to/service-account-key.json'
)
billing_client = billing_v1.CloudBillingClient(credentials=credentials)
```

#### List Billing Accounts
```python
def list_billing_accounts():
    """List all billing accounts"""
    accounts = billing_client.list_billing_accounts()
    return [account for account in accounts]
```

#### Get Billing Account Budgets
```python
from google.cloud import billing_budgets_v1

budget_client = billing_budgets_v1.BudgetServiceClient(credentials=credentials)

def get_budgets(billing_account_name):
    """Get budgets for a billing account"""
    parent = billing_account_name
    budgets = budget_client.list_budgets(parent=parent)
    return [budget for budget in budgets]
```

#### Get Cost Breakdown
```python
from google.cloud import billing_v1

def get_cost_breakdown(project_id, start_date, end_date):
    """Get cost breakdown for a project"""
    # Use Cloud Billing API or BigQuery billing export
    # Requires billing export to BigQuery enabled
    pass
```

### Azure Cost Management API

#### Setup
```python
from azure.identity import DefaultAzureCredential
from azure.mgmt.costmanagement import CostManagementClient

credential = DefaultAzureCredential()
cost_client = CostManagementClient(credential, subscription_id='your-subscription-id')
```

#### Query Cost Data
```python
def get_azure_costs(scope, start_date, end_date):
    """Get Azure costs for a scope"""
    query_definition = {
        "type": "ActualCost",
        "timeframe": "Custom",
        "timePeriod": {
            "from": start_date,
            "to": end_date
        },
        "dataset": {
            "granularity": "Daily",
            "aggregation": {
                "totalCost": {
                    "name": "PreTaxCost",
                    "function": "Sum"
                }
            },
            "grouping": [
                {
                    "type": "Dimension",
                    "name": "ResourceGroup"
                }
            ]
        }
    }

    result = cost_client.query.usage(scope, query_definition)
    return result
```

#### Get Budgets
```python
from azure.mgmt.consumption import ConsumptionManagementClient

consumption_client = ConsumptionManagementClient(credential, subscription_id='your-subscription-id')

def get_budgets():
    """Get budgets for subscription"""
    budgets = consumption_client.budgets.list(subscription_id='your-subscription-id')
    return [budget for budget in budgets]
```

## LLM Service Cost APIs

### OpenAI Usage API

#### Setup
```python
import openai
from openai import OpenAI

client = OpenAI(api_key='EXAMPLE_API_KEY')
```

#### Get Usage Data
```python
def get_openai_usage(start_date, end_date):
    """Get OpenAI usage and costs"""
    # OpenAI doesn't provide direct usage API
    # Use billing API or dashboard scraping

    # Alternative: Track usage in your application
    # Log all API calls with token counts
    pass
```

#### Track Usage Programmatically
```python
import openai
from datetime import datetime

class OpenAICostTracker:
    def __init__(self):
        self.usage_log = []

    def track_request(self, model, input_tokens, output_tokens):
        """Track API request costs"""
        pricing = {
            'gpt-4o': {'input': 2.50, 'output': 5.00},
            'gpt-4-turbo': {'input': 10.00, 'output': 30.00},
            'gpt-3.5-turbo': {'input': 0.30, 'output': 0.60},
        }

        if model in pricing:
            input_cost = (input_tokens / 1_000_000) * pricing[model]['input']
            output_cost = (output_tokens / 1_000_000) * pricing[model]['output']
            total_cost = input_cost + output_cost

            self.usage_log.append({
                'timestamp': datetime.now(),
                'model': model,
                'input_tokens': input_tokens,
                'output_tokens': output_tokens,
                'cost': total_cost
            })

            return total_cost
        return 0
```

### Anthropic Usage Tracking

```python
import anthropic
from datetime import datetime

class AnthropicCostTracker:
    def __init__(self):
        self.usage_log = []

    def track_request(self, model, input_tokens, output_tokens):
        """Track Anthropic API costs"""
        pricing = {
            'claude-4-opus': {'input': 15.00, 'output': 75.00},
            'claude-4-sonnet': {'input': 3.00, 'output': 15.00},
            'claude-3-5-sonnet': {'input': 3.00, 'output': 15.00},
        }

        if model in pricing:
            input_cost = (input_tokens / 1_000_000) * pricing[model]['input']
            output_cost = (output_tokens / 1_000_000) * pricing[model]['output']
            total_cost = input_cost + output_cost

            self.usage_log.append({
                'timestamp': datetime.now(),
                'model': model,
                'input_tokens': input_tokens,
                'output_tokens': output_tokens,
                'cost': total_cost
            })

            return total_cost
        return 0
```

### Google Gemini Usage Tracking

```python
import google.generativeai as genai
from datetime import datetime

class GeminiCostTracker:
    def __init__(self):
        self.usage_log = []

    def track_request(self, model, input_tokens, output_tokens, context_length=0):
        """Track Gemini API costs"""
        pricing = {
            'gemini-2.5-pro': {
                'input': {0: 1.25, 200000: 2.50},  # ≤200k: $1.25, >200k: $2.50
                'output': {0: 10.00, 200000: 15.00}
            },
            'gemini-2.5-flash': {'input': 0.075, 'output': 0.30},
            'gemini-1.5-pro': {'input': 0.0781, 'output': 0.3125},
            'gemini-1.5-flash': {'input': 0.075, 'output': 0.30},
        }

        if model in pricing:
            model_pricing = pricing[model]

            # Handle context-based pricing for Pro models
            if isinstance(model_pricing['input'], dict):
                input_rate = model_pricing['input'][0] if context_length <= 200000 else model_pricing['input'][200000]
                output_rate = model_pricing['output'][0] if context_length <= 200000 else model_pricing['output'][200000]
            else:
                input_rate = model_pricing['input']
                output_rate = model_pricing['output']

            input_cost = (input_tokens / 1_000_000) * input_rate
            output_cost = (output_tokens / 1_000_000) * output_rate
            total_cost = input_cost + output_cost

            self.usage_log.append({
                'timestamp': datetime.now(),
                'model': model,
                'input_tokens': input_tokens,
                'output_tokens': output_tokens,
                'context_length': context_length,
                'cost': total_cost
            })

            return total_cost
        return 0
```

## Web Scraping for Cost Data

### General Web Scraping Approach

#### Using Selenium for Dynamic Content
```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def scrape_dashboard_costs(url, credentials):
    """Scrape cost data from dashboard"""
    driver = webdriver.Chrome()

    try:
        driver.get(url)

        # Login if needed
        # ... login logic ...

        # Wait for cost data to load
        wait = WebDriverWait(driver, 10)
        cost_element = wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "cost-value"))
        )

        # Extract cost data
        cost = cost_element.text

        return cost
    finally:
        driver.quit()
```

#### Using BeautifulSoup for Static Content
```python
import requests
from bs4 import BeautifulSoup

def scrape_pricing_page(url):
    """Scrape pricing information from webpage"""
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Extract pricing data based on page structure
    pricing_elements = soup.find_all('div', class_='pricing')

    pricing_data = []
    for element in pricing_elements:
        price = element.find('span', class_='price').text
        plan = element.find('h3').text
        pricing_data.append({'plan': plan, 'price': price})

    return pricing_data
```

## Cost Monitoring Dashboard

### Building a Cost Dashboard

#### Data Collection Script
```python
import json
from datetime import datetime, timedelta
import boto3
from openai import OpenAI

class CostMonitor:
    def __init__(self):
        self.aws_client = boto3.client('ce')
        self.openai_client = OpenAI()
        self.cost_data = []

    def collect_all_costs(self):
        """Collect costs from all services"""
        today = datetime.now()
        start_date = (today - timedelta(days=30)).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')

        # AWS costs
        aws_costs = self.get_aws_costs(start_date, end_date)

        # LLM costs (from your tracking)
        llm_costs = self.get_llm_costs(start_date, end_date)

        # Combine all costs
        total_costs = {
            'aws': aws_costs,
            'llm': llm_costs,
            'total': aws_costs + llm_costs,
            'period': {'start': start_date, 'end': end_date}
        }

        return total_costs

    def get_aws_costs(self, start_date, end_date):
        """Get AWS costs"""
        response = self.aws_client.get_cost_and_usage(
            TimePeriod={'Start': start_date, 'End': end_date},
            Granularity='DAILY',
            Metrics=['BlendedCost']
        )

        total_cost = 0
        for result in response['ResultsByTime']:
            total_cost += float(result['Total']['BlendedCost']['Amount'])

        return total_cost

    def get_llm_costs(self, start_date, end_date):
        """Get LLM costs from tracking"""
        # Load from your usage tracking database/logs
        # This is a placeholder
        return 0

    def generate_report(self):
        """Generate cost report"""
        costs = self.collect_all_costs()

        report = {
            'timestamp': datetime.now().isoformat(),
            'costs': costs,
            'summary': {
                'total': costs['total'],
                'aws_percentage': (costs['aws'] / costs['total']) * 100 if costs['total'] > 0 else 0,
                'llm_percentage': (costs['llm'] / costs['total']) * 100 if costs['total'] > 0 else 0
            }
        }

        return report
```

## Cost Alerting System

### Setting Up Cost Alerts

#### AWS Budget Alerts
```python
def create_aws_budget(budget_name, amount, email):
    """Create AWS budget with alerts"""
    budgets_client = boto3.client('budgets')

    budget = {
        'BudgetName': budget_name,
        'BudgetLimit': {
            'Amount': str(amount),
            'Unit': 'USD'
        },
        'TimeUnit': 'MONTHLY',
        'BudgetType': 'COST',
        'CalculatedSpend': {
            'ActualSpend': {
                'Amount': '0',
                'Unit': 'USD'
            }
        },
        'CostFilters': {},
        'NotificationsWithSubscribers': [
            {
                'Notification': {
                    'NotificationType': 'ACTUAL',
                    'ComparisonOperator': 'GREATER_THAN',
                    'Threshold': 80,
                    'ThresholdType': 'PERCENTAGE'
                },
                'Subscribers': [
                    {
                        'SubscriptionType': 'EMAIL',
                        'Address': email
                    }
                ]
            }
        ]
    }

    response = budgets_client.create_budget(
        AccountId='your-account-id',
        Budget=budget
    )

    return response
```

#### Custom Cost Alert System
```python
import smtplib
from email.mime.text import MIMEText
from datetime import datetime

class CostAlertSystem:
    def __init__(self, threshold_percentage=80):
        self.threshold_percentage = threshold_percentage
        self.monitor = CostMonitor()

    def check_budget(self, budget_amount):
        """Check if costs exceed threshold"""
        costs = self.monitor.collect_all_costs()
        total_cost = costs['total']

        percentage = (total_cost / budget_amount) * 100

        if percentage >= self.threshold_percentage:
            self.send_alert(total_cost, budget_amount, percentage)

        return percentage

    def send_alert(self, current_cost, budget, percentage):
        """Send cost alert email"""
        subject = f"Cost Alert: {percentage:.1f}% of budget used"
        body = f"""
        Current Cost: ${current_cost:.2f}
        Budget: ${budget:.2f}
        Percentage Used: {percentage:.1f}%

        Please review your spending.
        """

        # Send email (implement email sending logic)
        print(f"ALERT: {subject}\n{body}")
```

## Advanced Cost Scraping Techniques

### Advanced AWS Cost Explorer Queries

#### Cost Allocation Tags
```python
def get_costs_by_tags(start_date, end_date, tags):
    """Get costs grouped by resource tags"""
    response = ce_client.get_cost_and_usage(
        TimePeriod={'Start': start_date, 'End': end_date},
        Granularity='DAILY',
        Metrics=['BlendedCost'],
        GroupBy=[
            {'Type': 'TAG', 'Key': tag} for tag in tags
        ],
        Filter={
            'Tags': {
                'Key': 'Environment',
                'Values': ['Production', 'Staging']
            }
        }
    )
    return response
```

#### Cost by Resource Type
```python
def get_costs_by_resource_type(start_date, end_date):
    """Get costs grouped by resource type"""
    response = ce_client.get_cost_and_usage(
        TimePeriod={'Start': start_date, 'End': end_date},
        Granularity='DAILY',
        Metrics=['BlendedCost', 'UsageQuantity'],
        GroupBy=[
            {'Type': 'DIMENSION', 'Key': 'RESOURCE_ID'},
            {'Type': 'DIMENSION', 'Key': 'SERVICE'}
        ]
    )
    return response
```

#### Cost Anomaly Detection Setup
```python
def create_anomaly_monitor(monitor_name, threshold=100):
    """Create cost anomaly detection monitor"""
    budgets_client = boto3.client('budgets')

    # First create a budget
    budget_response = budgets_client.create_budget(
        AccountId='your-account-id',
        Budget={
            'BudgetName': f'{monitor_name}-budget',
            'BudgetLimit': {'Amount': str(threshold), 'Unit': 'USD'},
            'TimeUnit': 'MONTHLY',
            'BudgetType': 'COST'
        }
    )

    # Then create anomaly monitor
    ce_client = boto3.client('ce')
    monitor_response = ce_client.create_anomaly_monitor(
        AnomalyMonitor={
            'MonitorName': monitor_name,
            'MonitorType': 'DIMENSIONAL',
            'MonitorDimension': 'SERVICE'
        }
    )

    return monitor_response
```

#### Advanced Filtering
```python
def get_filtered_costs(start_date, end_date, filters):
    """
    Get costs with advanced filtering

    Filters example:
    {
        'Tags': {'Key': 'Project', 'Values': ['ProjectA']},
        'Services': ['AmazonEC2', 'AmazonS3'],
        'Regions': ['us-east-1', 'us-west-2']
    }
    """
    filter_expression = {}

    if 'Tags' in filters:
        filter_expression['Tags'] = filters['Tags']

    if 'Services' in filters:
        filter_expression['Dimensions'] = {
            'Key': 'SERVICE',
            'Values': filters['Services']
        }

    if 'Regions' in filters:
        filter_expression['Dimensions'] = {
            'Key': 'REGION',
            'Values': filters['Regions']
        }

    response = ce_client.get_cost_and_usage(
        TimePeriod={'Start': start_date, 'End': end_date},
        Granularity='DAILY',
        Metrics=['BlendedCost'],
        Filter=filter_expression
    )

    return response
```

### Cost Allocation Strategies

#### Tag-Based Cost Allocation
```python
def allocate_costs_by_project(start_date, end_date):
    """Allocate costs by project using tags"""
    response = ce_client.get_cost_and_usage(
        TimePeriod={'Start': start_date, 'End': end_date},
        Granularity='MONTHLY',
        Metrics=['BlendedCost'],
        GroupBy=[
            {'Type': 'TAG', 'Key': 'Project'},
            {'Type': 'TAG', 'Key': 'Environment'}
        ]
    )

    allocation = {}
    for result in response['ResultsByTime']:
        for group in result.get('Groups', []):
            project = group['Keys'][0] if group['Keys'][0] else 'Untagged'
            env = group['Keys'][1] if len(group['Keys']) > 1 else 'Unknown'
            cost = float(group['Metrics']['BlendedCost']['Amount'])

            if project not in allocation:
                allocation[project] = {}
            allocation[project][env] = cost

    return allocation
```

#### Department Cost Allocation
```python
def allocate_costs_by_department(start_date, end_date):
    """Allocate costs by department"""
    response = ce_client.get_cost_and_usage(
        TimePeriod={'Start': start_date, 'End': end_date},
        Granularity='MONTHLY',
        Metrics=['BlendedCost'],
        GroupBy=[
            {'Type': 'TAG', 'Key': 'Department'},
            {'Type': 'DIMENSION', 'Key': 'SERVICE'}
        ]
    )

    return response
```

### Machine Learning Cost Anomaly Detection

#### Statistical Anomaly Detection
```python
import numpy as np
from scipy import stats

def detect_cost_anomalies(cost_data, threshold=2.5):
    """
    Detect cost anomalies using statistical methods

    Args:
        cost_data: List of daily costs
        threshold: Z-score threshold (default 2.5)

    Returns:
        List of anomaly indices
    """
    costs = np.array(cost_data)
    z_scores = np.abs(stats.zscore(costs))
    anomalies = np.where(z_scores > threshold)[0]

    return anomalies.tolist()
```

#### Time Series Anomaly Detection
```python
from sklearn.ensemble import IsolationForest

def detect_time_series_anomalies(cost_data):
    """Detect anomalies using Isolation Forest"""
    # Reshape for sklearn
    X = np.array(cost_data).reshape(-1, 1)

    # Fit isolation forest
    isolation_forest = IsolationForest(contamination=0.1)
    predictions = isolation_forest.fit_predict(X)

    # Get anomalies (predictions == -1)
    anomalies = np.where(predictions == -1)[0]

    return anomalies.tolist()
```

### Multi-Cloud Cost Aggregation

#### Unified Cost View
```python
class MultiCloudCostAggregator:
    """Aggregate costs from multiple cloud providers"""

    def __init__(self):
        self.aws_scraper = None
        self.gcp_scraper = None
        self.azure_scraper = None

    def aggregate_costs(self, start_date, end_date):
        """Aggregate costs from all providers"""
        all_costs = []

        # AWS costs
        if self.aws_scraper:
            aws_costs = self.aws_scraper.get_costs(start_date, end_date)
            all_costs.extend(aws_costs)

        # GCP costs
        if self.gcp_scraper:
            gcp_costs = self.gcp_scraper.get_costs(start_date, end_date)
            all_costs.extend(gcp_costs)

        # Azure costs
        if self.azure_scraper:
            azure_costs = self.azure_scraper.get_costs(start_date, end_date)
            all_costs.extend(azure_costs)

        # Aggregate by date
        aggregated = {}
        for cost in all_costs:
            if cost.date not in aggregated:
                aggregated[cost.date] = {'aws': 0, 'gcp': 0, 'azure': 0, 'total': 0}

            provider = cost.service.split('-')[0].lower()
            if provider in aggregated[cost.date]:
                aggregated[cost.date][provider] += cost.amount
            aggregated[cost.date]['total'] += cost.amount

        return aggregated
```

### Cost Forecasting

#### Time Series Forecasting
```python
from statsmodels.tsa.arima.model import ARIMA
import pandas as pd

def forecast_costs(historical_costs, periods=30):
    """
    Forecast future costs using ARIMA

    Args:
        historical_costs: List of daily costs
        periods: Number of days to forecast

    Returns:
        Forecasted costs
    """
    # Convert to pandas Series
    ts = pd.Series(historical_costs)

    # Fit ARIMA model
    model = ARIMA(ts, order=(1, 1, 1))
    fitted_model = model.fit()

    # Forecast
    forecast = fitted_model.forecast(steps=periods)

    return forecast.tolist()
```

## Best Practices

### 1. Authentication & Security
- Use IAM roles and service accounts
- Store credentials securely (AWS Secrets Manager, Azure Key Vault)
- Rotate API keys regularly
- Use least-privilege access policies
- Enable MFA for cost API access
- Use service account keys with minimal permissions

### 2. Rate Limiting
- Implement rate limiting for API calls
- Cache responses when appropriate
- Use batch APIs when available
- Respect API rate limits
- Implement exponential backoff for retries
- Use connection pooling

### 3. Data Storage
- Store cost data in time-series database (InfluxDB, TimescaleDB)
- Use data warehouses for analysis (BigQuery, Redshift)
- Implement data retention policies
- Backup cost data regularly
- Use columnar storage for analytics
- Partition data by date for performance

### 4. Monitoring & Alerting
- Set up multiple alert thresholds (50%, 80%, 100%)
- Use multiple notification channels (email, Slack, PagerDuty)
- Monitor cost anomalies using ML
- Track cost trends over time
- Set up anomaly detection monitors
- Create custom dashboards for stakeholders

### 5. Automation
- Schedule regular cost collection
- Automate report generation
- Set up automated budget creation
- Implement cost optimization recommendations
- Automate cost allocation tagging
- Schedule cost anomaly detection runs

### 6. Cost Allocation
- Implement consistent tagging strategy
- Tag resources at creation time
- Use automated tagging policies
- Review untagged resources regularly
- Allocate costs by project/department
- Track cost per service/team

## Advanced Cost Scraping: Large Datasets & Pagination

### Handling Large Cost Datasets

#### Paginated Cost Queries
```python
def get_all_costs_paginated(start_date, end_date, max_results=1000):
    """Get all costs using pagination"""
    all_results = []
    next_token = None

    while True:
        params = {
            'TimePeriod': {'Start': start_date, 'End': end_date},
            'Granularity': 'DAILY',
            'Metrics': ['BlendedCost'],
            'MaxResults': max_results
        }

        if next_token:
            params['NextPageToken'] = next_token

        response = ce_client.get_cost_and_usage(**params)

        all_results.extend(response.get('ResultsByTime', []))

        next_token = response.get('NextPageToken')
        if not next_token:
            break

    return all_results
```

#### Cost Data Export to S3
```python
def export_costs_to_s3(start_date, end_date, s3_bucket, s3_key):
    """Export cost data to S3"""
    # Create cost report definition
    report_definition = {
        'ReportName': f'cost-report-{start_date}-{end_date}',
        'TimeUnit': 'DAILY',
        'Format': 'textORcsv',
        'Compression': 'GZIP',
        'AdditionalSchemaElements': ['RESOURCES'],
        'S3Bucket': s3_bucket,
        'S3Prefix': s3_key,
        'S3Region': 'us-east-1',
        'ReportVersioning': 'OVERWRITE_REPORT'
    }

    # Create report
    cur_client = boto3.client('cur')  # Cost and Usage Reports
    response = cur_client.put_report_definition(
        ReportDefinition=report_definition
    )

    return response
```

### Cost Data Streaming

#### Streaming Large Cost Queries
```python
import json
from datetime import datetime

def stream_costs_to_file(start_date, end_date, output_file):
    """Stream cost data to file to handle large datasets"""
    with open(output_file, 'w') as f:
        f.write('[')  # Start JSON array

        first = True
        next_token = None

        while True:
            params = {
                'TimePeriod': {'Start': start_date, 'End': end_date},
                'Granularity': 'DAILY',
                'Metrics': ['BlendedCost']
            }

            if next_token:
                params['NextPageToken'] = next_token

            response = ce_client.get_cost_and_usage(**params)

            for result in response.get('ResultsByTime', []):
                if not first:
                    f.write(',')
                json.dump(result, f)
                first = False

            next_token = response.get('NextPageToken')
            if not next_token:
                break

        f.write(']')  # End JSON array
```

## Multi-Tenant Cost Allocation

### Per-Customer Cost Tracking

#### Customer-Level Cost Allocation
```python
class MultiTenantCostTracker:
    """Track costs per customer/tenant"""

    def __init__(self):
        self.customer_costs = {}
        self.resource_tags = {}

    def tag_resource_for_customer(self, resource_id, customer_id):
        """Tag resource for customer tracking"""
        self.resource_tags[resource_id] = customer_id

    def allocate_cost_to_customer(self, resource_id, cost, date):
        """Allocate cost to specific customer"""
        customer_id = self.resource_tags.get(resource_id, 'unknown')

        if customer_id not in self.customer_costs:
            self.customer_costs[customer_id] = []

        self.customer_costs[customer_id].append({
            'date': date,
            'resource_id': resource_id,
            'cost': cost
        })

    def get_customer_costs(self, customer_id, start_date, end_date):
        """Get costs for specific customer"""
        if customer_id not in self.customer_costs:
            return []

        costs = self.customer_costs[customer_id]
        filtered = [
            c for c in costs
            if start_date <= c['date'] <= end_date
        ]

        return filtered

    def generate_customer_bill(self, customer_id, start_date, end_date):
        """Generate bill for customer"""
        costs = self.get_customer_costs(customer_id, start_date, end_date)
        total = sum(c['cost'] for c in costs)

        return {
            'customer_id': customer_id,
            'period': {'start': start_date, 'end': end_date},
            'line_items': costs,
            'total': total,
            'currency': 'USD'
        }
```

### Per-User LLM Cost Tracking

#### User-Level LLM Cost Allocation
```python
class UserLLMCostTracker:
    """Track LLM costs per user"""

    def __init__(self):
        self.user_costs = {}
        self.llm_tracker = LLMCostTracker()

    def track_user_request(self, user_id, provider, model,
                          input_tokens, output_tokens):
        """Track LLM request for specific user"""
        cost = self.llm_tracker.track_request(
            provider, model, input_tokens, output_tokens
        )

        if user_id not in self.user_costs:
            self.user_costs[user_id] = []

        self.user_costs[user_id].append({
            'timestamp': datetime.now().isoformat(),
            'provider': provider,
            'model': model,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'cost': cost
        })

        return cost

    def get_user_costs(self, user_id, start_date, end_date):
        """Get costs for specific user"""
        if user_id not in self.user_costs:
            return []

        costs = self.user_costs[user_id]
        filtered = []

        for cost in costs:
            cost_date = datetime.fromisoformat(cost['timestamp']).date()
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()

            if start <= cost_date <= end:
                filtered.append(cost)

        return filtered

    def get_user_total_cost(self, user_id, start_date, end_date):
        """Get total cost for user"""
        costs = self.get_user_costs(user_id, start_date, end_date)
        return sum(c['cost'] for c in costs)
```

## Cost Governance & Policies

### Automated Cost Policies

#### Cost Policy Enforcement
```python
class CostPolicyEngine:
    """Enforce cost policies automatically"""

    def __init__(self):
        self.policies = []

    def add_policy(self, name, condition, action):
        """Add a cost policy"""
        self.policies.append({
            'name': name,
            'condition': condition,
            'action': action
        })

    def evaluate_policies(self, cost_data):
        """Evaluate all policies against cost data"""
        violations = []

        for policy in self.policies:
            if policy['condition'](cost_data):
                violations.append({
                    'policy': policy['name'],
                    'action': policy['action'](cost_data)
                })

        return violations

    def enforce_budget_limit(self, budget_limit):
        """Create policy for budget limit"""
        def condition(cost_data):
            return cost_data['total'] > budget_limit

        def action(cost_data):
            # Stop resources, send alerts, etc.
            return f"Budget exceeded: ${cost_data['total']:.2f} > ${budget_limit}"

        self.add_policy('budget_limit', condition, action)
```

### Cost Approval Workflows

#### Cost Approval System
```python
class CostApprovalWorkflow:
    """Manage cost approval workflows"""

    def __init__(self):
        self.approvals = {}
        self.thresholds = {
            'low': 100,
            'medium': 500,
            'high': 1000
        }

    def requires_approval(self, cost):
        """Check if cost requires approval"""
        if cost > self.thresholds['high']:
            return 'high'
        elif cost > self.thresholds['medium']:
            return 'medium'
        elif cost > self.thresholds['low']:
            return 'low'
        return None

    def request_approval(self, cost_id, amount, requester):
        """Request approval for cost"""
        level = self.requires_approval(amount)

        if level:
            self.approvals[cost_id] = {
                'amount': amount,
                'requester': requester,
                'level': level,
                'status': 'pending',
                'timestamp': datetime.now().isoformat()
            }
            return True
        return False

    def approve_cost(self, cost_id, approver):
        """Approve a cost request"""
        if cost_id in self.approvals:
            self.approvals[cost_id]['status'] = 'approved'
            self.approvals[cost_id]['approver'] = approver
            return True
        return False
```

## Cost Optimization: Right-Sizing & Reserved Instances

### Right-Sizing Analysis

#### Resource Right-Sizing
```python
def analyze_resource_rightsizing(resource_id, usage_data):
    """Analyze if resource is right-sized"""
    avg_cpu = sum(d['cpu'] for d in usage_data) / len(usage_data)
    avg_memory = sum(d['memory'] for d in usage_data) / len(usage_data)

    current_size = get_resource_size(resource_id)

    recommendations = []

    # CPU analysis
    if avg_cpu < current_size['cpu'] * 0.3:
        recommendations.append({
            'type': 'downsize',
            'metric': 'cpu',
            'current': current_size['cpu'],
            'recommended': current_size['cpu'] * 0.5,
            'savings': calculate_savings(current_size['cpu'], current_size['cpu'] * 0.5)
        })

    # Memory analysis
    if avg_memory < current_size['memory'] * 0.3:
        recommendations.append({
            'type': 'downsize',
            'metric': 'memory',
            'current': current_size['memory'],
            'recommended': current_size['memory'] * 0.5,
            'savings': calculate_savings(current_size['memory'], current_size['memory'] * 0.5)
        })

    return recommendations
```

### Reserved Instance Analysis

#### RI Purchase Recommendations
```python
def analyze_ri_purchases(instance_usage, lookback_days=30):
    """Analyze Reserved Instance purchase opportunities"""
    # Get instance usage over lookback period
    usage = get_instance_usage(instance_usage, lookback_days)

    # Calculate utilization
    total_hours = lookback_days * 24
    utilized_hours = sum(u['hours'] for u in usage)
    utilization = utilized_hours / total_hours

    recommendations = []

    # Recommend RI if utilization > 50%
    if utilization > 0.5:
        instance_type = usage[0]['instance_type']
        on_demand_cost = calculate_on_demand_cost(instance_type, utilized_hours)
        ri_cost = calculate_ri_cost(instance_type, 1)  # 1-year RI

        savings = on_demand_cost - ri_cost

        recommendations.append({
            'instance_type': instance_type,
            'utilization': utilization,
            'on_demand_cost': on_demand_cost,
            'ri_cost': ri_cost,
            'savings': savings,
            'savings_percentage': (savings / on_demand_cost) * 100
        })

    return recommendations
```

## Tools & Libraries

### Python Libraries
- **boto3**: AWS SDK for Python
- **google-cloud-billing**: Google Cloud Billing API
- **azure-mgmt-costmanagement**: Azure Cost Management
- **selenium**: Web scraping for dynamic content
- **beautifulsoup4**: HTML parsing
- **requests**: HTTP requests
- **pandas**: Data analysis
- **matplotlib/plotly**: Visualization
- **numpy**: Numerical computing
- **scipy**: Scientific computing (for anomaly detection)
- **scikit-learn**: Machine learning (for anomaly detection)
- **statsmodels**: Statistical modeling (for forecasting)

### Third-Party Tools
- **CloudHealth**: Multi-cloud cost management
- **CloudCheckr**: AWS cost optimization
- **Spot.io**: Cloud cost optimization
- **Densify**: Container cost optimization
- **Kubecost**: Kubernetes cost monitoring
- **Cloudability**: Cloud financial management
- **ParkMyCloud**: Cloud cost optimization
- **Turbonomic**: Application resource management

## Showback vs Chargeback Models

### Showback Model

#### Implementation
```python
class ShowbackModel:
    """Showback: Show costs without charging back"""

    def __init__(self):
        self.cost_reports = {}

    def generate_showback_report(self, department, start_date, end_date):
        """Generate showback report for department"""
        costs = self.get_department_costs(department, start_date, end_date)

        report = {
            'department': department,
            'period': {'start': start_date, 'end': end_date},
            'total_cost': sum(c['amount'] for c in costs),
            'by_service': self._group_by_service(costs),
            'by_project': self._group_by_project(costs),
            'trends': self._calculate_trends(department, start_date, end_date),
            'recommendations': self._generate_recommendations(costs)
        }

        return report

    def _generate_recommendations(self, costs):
        """Generate cost optimization recommendations"""
        recommendations = []

        # Find high-cost services
        service_costs = self._group_by_service(costs)
        top_services = sorted(service_costs.items(),
                            key=lambda x: x[1], reverse=True)[:3]

        for service, cost in top_services:
            recommendations.append({
                'service': service,
                'cost': cost,
                'recommendation': f'Review {service} usage - ${cost:.2f}'
            })

        return recommendations
```

### Chargeback Model

#### Implementation
```python
class ChargebackModel:
    """Chargeback: Actually charge costs back to departments"""

    def __init__(self):
        self.allocations = {}
        self.billing_records = []

    def allocate_cost(self, resource_id, cost, department, date):
        """Allocate cost to department"""
        if department not in self.allocations:
            self.allocations[department] = []

        self.allocations[department].append({
            'resource_id': resource_id,
            'cost': cost,
            'date': date
        })

    def generate_chargeback_bill(self, department, start_date, end_date):
        """Generate chargeback bill for department"""
        costs = [
            a for a in self.allocations.get(department, [])
            if start_date <= a['date'] <= end_date
        ]

        bill = {
            'department': department,
            'period': {'start': start_date, 'end': end_date},
            'line_items': costs,
            'subtotal': sum(c['cost'] for c in costs),
            'tax': 0,  # Add tax if applicable
            'total': sum(c['cost'] for c in costs),
            'currency': 'USD',
            'due_date': end_date  # Typically 30 days after period end
        }

        self.billing_records.append(bill)
        return bill

    def process_chargeback(self, department, start_date, end_date):
        """Process chargeback and integrate with billing system"""
        bill = self.generate_chargeback_bill(department, start_date, end_date)

        # Integrate with accounting system
        # This would typically call an API or write to a database
        self._send_to_accounting_system(bill)

        return bill
```

## FinOps Maturity Model

### Maturity Levels

#### Level 1: Crawl (Basic Visibility)
```python
class FinOpsMaturityLevel1:
    """Basic cost visibility"""

    def __init__(self):
        self.cost_tracking = {}

    def track_basic_costs(self, service, cost, date):
        """Basic cost tracking"""
        if service not in self.cost_tracking:
            self.cost_tracking[service] = []

        self.cost_tracking[service].append({
            'date': date,
            'cost': cost
        })

    def get_total_cost(self, start_date, end_date):
        """Get total cost for period"""
        total = 0
        for service, costs in self.cost_tracking.items():
            for cost_entry in costs:
                if start_date <= cost_entry['date'] <= end_date:
                    total += cost_entry['cost']
        return total
```

#### Level 2: Walk (Cost Allocation)
```python
class FinOpsMaturityLevel2:
    """Cost allocation and tagging"""

    def __init__(self):
        self.cost_tracker = FinOpsMaturityLevel1()
        self.tags = {}

    def tag_resource(self, resource_id, tags):
        """Tag resources for cost allocation"""
        self.tags[resource_id] = tags

    def allocate_costs(self, resource_id, cost, date):
        """Allocate costs by tags"""
        tags = self.tags.get(resource_id, {})

        # Track by department
        if 'Department' in tags:
            self.cost_tracker.track_basic_costs(
                f"Department-{tags['Department']}", cost, date
            )

        # Track by project
        if 'Project' in tags:
            self.cost_tracker.track_basic_costs(
                f"Project-{tags['Project']}", cost, date
            )
```

#### Level 3: Run (Optimization)
```python
class FinOpsMaturityLevel3:
    """Cost optimization"""

    def __init__(self):
        self.level2 = FinOpsMaturityLevel2()
        self.optimization_engine = CostOptimizationEngine()

    def optimize_costs(self, start_date, end_date):
        """Run cost optimization"""
        recommendations = self.optimization_engine.analyze(
            start_date, end_date
        )

        # Implement recommendations
        for rec in recommendations:
            if rec['type'] == 'right_size':
                self._right_size_resource(rec['resource_id'])
            elif rec['type'] == 'reserved_instance':
                self._purchase_ri(rec['instance_type'])

        return recommendations
```

#### Level 4: Fly (Automated Optimization)
```python
class FinOpsMaturityLevel4:
    """Automated cost optimization"""

    def __init__(self):
        self.level3 = FinOpsMaturityLevel3()
        self.automation_engine = AutomationEngine()

    def setup_automated_optimization(self):
        """Set up automated optimization"""
        # Auto-right-size based on usage
        self.automation_engine.schedule_task(
            'right_size_resources',
            schedule='daily',
            action=self._auto_right_size
        )

        # Auto-purchase RIs based on patterns
        self.automation_engine.schedule_task(
            'purchase_ris',
            schedule='weekly',
            action=self._auto_purchase_ris
        )
```

## Spot Instances & Savings Plans

### Spot Instance Cost Optimization

#### Spot Instance Strategy
```python
class SpotInstanceOptimizer:
    """Optimize costs using spot instances"""

    def __init__(self):
        self.spot_prices = {}
        self.on_demand_prices = {}

    def calculate_spot_savings(self, instance_type, region):
        """Calculate potential spot instance savings"""
        on_demand_price = self.on_demand_prices.get(
            (instance_type, region), 0
        )
        spot_price = self.spot_prices.get((instance_type, region), 0)

        if on_demand_price > 0:
            savings = ((on_demand_price - spot_price) / on_demand_price) * 100
            return {
                'instance_type': instance_type,
                'region': region,
                'on_demand_price': on_demand_price,
                'spot_price': spot_price,
                'savings_percentage': savings,
                'savings_per_hour': on_demand_price - spot_price
            }
        return None

    def recommend_spot_usage(self, workload_type):
        """Recommend spot instances for workload type"""
        recommendations = {
            'batch': {
                'recommended': True,
                'reason': 'Batch jobs can tolerate interruptions',
                'savings': '60-90%'
            },
            'web_server': {
                'recommended': False,
                'reason': 'Requires high availability',
                'alternative': 'Use on-demand with auto-scaling'
            },
            'data_processing': {
                'recommended': True,
                'reason': 'Can checkpoint and resume',
                'savings': '70-90%'
            }
        }

        return recommendations.get(workload_type, {})
```

### Savings Plans Analysis

#### Compute Savings Plans
```python
class SavingsPlansAnalyzer:
    """Analyze Savings Plans opportunities"""

    def __init__(self):
        self.usage_history = []

    def analyze_savings_plan(self, commitment_amount, commitment_term='1yr'):
        """Analyze if Savings Plan is worth it"""
        # Get historical usage
        total_on_demand_cost = sum(
            u['cost'] for u in self.usage_history
        )

        # Calculate Savings Plan cost
        if commitment_term == '1yr':
            discount = 0.17  # 17% discount for 1-year
        elif commitment_term == '3yr':
            discount = 0.52  # 52% discount for 3-year

        savings_plan_cost = commitment_amount * (1 - discount)

        # Calculate break-even
        break_even_usage = commitment_amount / (total_on_demand_cost / len(self.usage_history))

        return {
            'commitment_amount': commitment_amount,
            'commitment_term': commitment_term,
            'discount': discount,
            'savings_plan_cost': savings_plan_cost,
            'on_demand_cost': total_on_demand_cost,
            'potential_savings': total_on_demand_cost - savings_plan_cost,
            'break_even_usage': break_even_usage,
            'recommendation': 'purchase' if break_even_usage < 1.0 else 'wait'
        }
```

## Implementation Checklist

- [ ] Set up authentication for cloud providers
- [ ] Configure cost APIs access
- [ ] Implement cost collection scripts
- [ ] Set up data storage (database/data warehouse)
- [ ] Create cost tracking for LLM services
- [ ] Build cost monitoring dashboard
- [ ] Set up cost alerts and budgets
- [ ] Implement cost anomaly detection
- [ ] Create cost reports and analytics
- [ ] Set up automated cost optimization
- [ ] Implement showback/chargeback model
- [ ] Set up cost allocation tags
- [ ] Configure spot instance usage
- [ ] Analyze Savings Plans opportunities
- [ ] Implement FinOps maturity improvements

## Next Steps

1. **Choose Your Services**: Identify which services you need to monitor
2. **Set Up APIs**: Configure API access for each service
3. **Build Collection Scripts**: Create scripts to collect cost data
4. **Set Up Storage**: Configure database or data warehouse
5. **Create Dashboard**: Build visualization dashboard
6. **Set Up Alerts**: Configure cost alerts and budgets
7. **Monitor & Optimize**: Continuously monitor and optimize costs
8. **Implement Showback/Chargeback**: Choose and implement cost allocation model
9. **Assess Maturity**: Evaluate current FinOps maturity level
10. **Optimize**: Implement spot instances and Savings Plans where appropriate

