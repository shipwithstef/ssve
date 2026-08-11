#!/usr/bin/env python3
"""
FinOps MCP Server - Example Implementation

This is an example MCP server for FinOps that can be customized for your needs.
It provides tools for cost monitoring, budget tracking, and cost optimization.

Usage:
    python finops-mcp-server.py

Configuration:
    Add to Cursor settings (~/.cursor/mcp.json) or Claude Desktop config:
    {
      "mcpServers": {
        "finops": {
          "command": "python",
          "args": ["/path/to/finops-mcp-server.py"],
          "env": {
            "AWS_ACCESS_KEY_ID": "your-key",
            "AWS_SECRET_ACCESS_KEY": "your-secret",
            "DATABASE_URL": "sqlite:///costs.db"
          }
        }
      }
    }
"""

import asyncio
import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

try:
    from mcp.server import Server
    from mcp.server.models import InitializationOptions
    import mcp.server.stdio
    import mcp.types as types
except ImportError:
    print("Error: MCP SDK not installed. Install with: pip install mcp")
    exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finops-mcp")

# Initialize MCP server
server = Server("finops-mcp")

# Database setup (SQLite for simplicity, can be replaced with PostgreSQL, etc.)
DB_PATH = os.getenv("DATABASE_URL", "sqlite:///costs.db").replace("sqlite:///", "")

def init_database():
    """Initialize SQLite database for cost tracking"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create costs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            category TEXT,
            metadata TEXT
        )
    """)
    
    # Create budgets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            amount REAL NOT NULL,
            period TEXT NOT NULL,
            alert_threshold REAL DEFAULT 0.8
        )
    """)
    
    conn.commit()
    conn.close()

@server.list_tools()
async def list_tools() -> List[types.Tool]:
    """List available FinOps tools"""
    return [
        types.Tool(
            name="get_costs",
            description="Get costs for a date range, optionally grouped by service, category, or date",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format"
                    },
                    "group_by": {
                        "type": "string",
                        "enum": ["service", "category", "date", "none"],
                        "description": "How to group the costs",
                        "default": "service"
                    },
                    "service": {
                        "type": "string",
                        "description": "Filter by specific service (optional)"
                    }
                },
                "required": ["start_date", "end_date"]
            }
        ),
        types.Tool(
            name="add_cost",
            description="Add a cost entry to the database",
            inputSchema={
                "type": "object",
                "properties": {
                    "service": {
                        "type": "string",
                        "description": "Service name (e.g., AWS-EC2, OpenAI-GPT-4o)"
                    },
                    "amount": {
                        "type": "number",
                        "description": "Cost amount in USD"
                    },
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format (defaults to today)"
                    },
                    "category": {
                        "type": "string",
                        "description": "Cost category (e.g., compute, storage, llm)"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Additional metadata as JSON object"
                    }
                },
                "required": ["service", "amount"]
            }
        ),
        types.Tool(
            name="get_budget_status",
            description="Get status of budgets, including usage percentage and alerts",
            inputSchema={
                "type": "object",
                "properties": {
                    "budget_name": {
                        "type": "string",
                        "description": "Specific budget name (optional, returns all if not specified)"
                    }
                }
            }
        ),
        types.Tool(
            name="create_budget",
            description="Create a new budget with optional alert threshold",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Budget name"
                    },
                    "amount": {
                        "type": "number",
                        "description": "Budget amount in USD"
                    },
                    "period": {
                        "type": "string",
                        "enum": ["daily", "weekly", "monthly", "yearly"],
                        "description": "Budget period"
                    },
                    "alert_threshold": {
                        "type": "number",
                        "description": "Alert when budget reaches this percentage (0-1, default 0.8)",
                        "default": 0.8
                    }
                },
                "required": ["name", "amount", "period"]
            }
        ),
        types.Tool(
            name="get_cost_summary",
            description="Get a summary of costs including totals, trends, and top services",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format"
                    }
                },
                "required": ["start_date", "end_date"]
            }
        ),
        types.Tool(
            name="estimate_llm_cost",
            description="Estimate cost for LLM API calls based on tokens and model",
            inputSchema={
                "type": "object",
                "properties": {
                    "provider": {
                        "type": "string",
                        "enum": ["openai", "anthropic", "google", "deepseek"],
                        "description": "LLM provider"
                    },
                    "model": {
                        "type": "string",
                        "description": "Model name (e.g., gpt-4o, claude-4-sonnet)"
                    },
                    "input_tokens": {
                        "type": "integer",
                        "description": "Number of input tokens"
                    },
                    "output_tokens": {
                        "type": "integer",
                        "description": "Number of output tokens"
                    }
                },
                "required": ["provider", "model", "input_tokens", "output_tokens"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle tool calls"""
    try:
        if name == "get_costs":
            result = await get_costs(
                arguments.get("start_date"),
                arguments.get("end_date"),
                arguments.get("group_by", "service"),
                arguments.get("service")
            )
        elif name == "add_cost":
            result = await add_cost(
                arguments.get("service"),
                arguments.get("amount"),
                arguments.get("date"),
                arguments.get("category"),
                arguments.get("metadata")
            )
        elif name == "get_budget_status":
            result = await get_budget_status(arguments.get("budget_name"))
        elif name == "create_budget":
            result = await create_budget(
                arguments.get("name"),
                arguments.get("amount"),
                arguments.get("period"),
                arguments.get("alert_threshold", 0.8)
            )
        elif name == "get_cost_summary":
            result = await get_cost_summary(
                arguments.get("start_date"),
                arguments.get("end_date")
            )
        elif name == "estimate_llm_cost":
            result = await estimate_llm_cost(
                arguments.get("provider"),
                arguments.get("model"),
                arguments.get("input_tokens"),
                arguments.get("output_tokens")
            )
        else:
            raise ValueError(f"Unknown tool: {name}")
        
        return [
            types.TextContent(
                type="text",
                text=json.dumps(result, indent=2)
            )
        ]
    except Exception as e:
        logger.error(f"Error in {name}: {e}")
        return [
            types.TextContent(
                type="text",
                text=json.dumps({"error": str(e)}, indent=2)
            )
        ]

async def get_costs(start_date: str, end_date: str, group_by: str = "service", service: Optional[str] = None):
    """Get costs from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    query = "SELECT service, amount, date, category FROM costs WHERE date BETWEEN ? AND ?"
    params = [start_date, end_date]
    
    if service:
        query += " AND service = ?"
        params.append(service)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    if group_by == "none":
        return [
            {
                "service": row[0],
                "amount": row[1],
                "date": row[2],
                "category": row[3]
            }
            for row in rows
        ]
    elif group_by == "service":
        grouped = {}
        for row in rows:
            service_name = row[0]
            if service_name not in grouped:
                grouped[service_name] = 0
            grouped[service_name] += row[1]
        return [{"service": k, "total": v} for k, v in grouped.items()]
    elif group_by == "category":
        grouped = {}
        for row in rows:
            category = row[3] or "uncategorized"
            if category not in grouped:
                grouped[category] = 0
            grouped[category] += row[1]
        return [{"category": k, "total": v} for k, v in grouped.items()]
    elif group_by == "date":
        grouped = {}
        for row in rows:
            date = row[2]
            if date not in grouped:
                grouped[date] = 0
            grouped[date] += row[1]
        return [{"date": k, "total": v} for k, v in sorted(grouped.items())]
    
    return []

async def add_cost(service: str, amount: float, date: Optional[str] = None, 
                   category: Optional[str] = None, metadata: Optional[Dict] = None):
    """Add cost entry to database"""
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    metadata_json = json.dumps(metadata) if metadata else None
    
    cursor.execute(
        "INSERT INTO costs (service, amount, date, category, metadata) VALUES (?, ?, ?, ?, ?)",
        (service, amount, date, category, metadata_json)
    )
    
    conn.commit()
    cost_id = cursor.lastrowid
    conn.close()
    
    return {
        "id": cost_id,
        "service": service,
        "amount": amount,
        "date": date,
        "category": category,
        "message": "Cost added successfully"
    }

async def get_budget_status(budget_name: Optional[str] = None):
    """Get budget status"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if budget_name:
        cursor.execute("SELECT name, amount, period, alert_threshold FROM budgets WHERE name = ?", (budget_name,))
    else:
        cursor.execute("SELECT name, amount, period, alert_threshold FROM budgets")
    
    budgets = cursor.fetchall()
    
    # Calculate current usage for each budget
    results = []
    for budget in budgets:
        name, amount, period, threshold = budget
        
        # Calculate period dates
        today = datetime.now().date()
        if period == "daily":
            start_date = today.strftime("%Y-%m-%d")
            end_date = today.strftime("%Y-%m-%d")
        elif period == "weekly":
            start_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
            end_date = today.strftime("%Y-%m-%d")
        elif period == "monthly":
            start_date = (today - timedelta(days=30)).strftime("%Y-%m-%d")
            end_date = today.strftime("%Y-%m-%d")
        else:  # yearly
            start_date = (today - timedelta(days=365)).strftime("%Y-%m-%d")
            end_date = today.strftime("%Y-%m-%d")
        
        # Get costs for period
        cursor.execute(
            "SELECT SUM(amount) FROM costs WHERE date BETWEEN ? AND ?",
            (start_date, end_date)
        )
        total_cost = cursor.fetchone()[0] or 0
        
        usage_percentage = (total_cost / amount) * 100 if amount > 0 else 0
        alert_triggered = usage_percentage >= (threshold * 100)
        
        results.append({
            "name": name,
            "budget_amount": amount,
            "period": period,
            "current_spend": total_cost,
            "usage_percentage": round(usage_percentage, 2),
            "alert_threshold": threshold * 100,
            "alert_triggered": alert_triggered,
            "remaining": amount - total_cost
        })
    
    conn.close()
    return results

async def create_budget(name: str, amount: float, period: str, alert_threshold: float = 0.8):
    """Create a new budget"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "INSERT INTO budgets (name, amount, period, alert_threshold) VALUES (?, ?, ?, ?)",
            (name, amount, period, alert_threshold)
        )
        conn.commit()
        budget_id = cursor.lastrowid
        conn.close()
        
        return {
            "id": budget_id,
            "name": name,
            "amount": amount,
            "period": period,
            "alert_threshold": alert_threshold,
            "message": "Budget created successfully"
        }
    except sqlite3.IntegrityError:
        conn.close()
        return {"error": f"Budget '{name}' already exists"}

async def get_cost_summary(start_date: str, end_date: str):
    """Get cost summary with trends and top services"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Total cost
    cursor.execute("SELECT SUM(amount) FROM costs WHERE date BETWEEN ? AND ?", (start_date, end_date))
    total_cost = cursor.fetchone()[0] or 0
    
    # Top services
    cursor.execute("""
        SELECT service, SUM(amount) as total
        FROM costs
        WHERE date BETWEEN ? AND ?
        GROUP BY service
        ORDER BY total DESC
        LIMIT 10
    """, (start_date, end_date))
    top_services = [{"service": row[0], "total": row[1]} for row in cursor.fetchall()]
    
    # Daily trend
    cursor.execute("""
        SELECT date, SUM(amount) as daily_total
        FROM costs
        WHERE date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date
    """, (start_date, end_date))
    daily_trend = [{"date": row[0], "amount": row[1]} for row in cursor.fetchall()]
    
    # Category breakdown
    cursor.execute("""
        SELECT category, SUM(amount) as total
        FROM costs
        WHERE date BETWEEN ? AND ?
        GROUP BY category
        ORDER BY total DESC
    """, (start_date, end_date))
    categories = [{"category": row[0] or "uncategorized", "total": row[1]} for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "period": {"start": start_date, "end": end_date},
        "total_cost": total_cost,
        "top_services": top_services,
        "daily_trend": daily_trend,
        "categories": categories
    }

async def estimate_llm_cost(provider: str, model: str, input_tokens: int, output_tokens: int):
    """Estimate LLM API cost"""
    # Pricing per million tokens (as of 2025)
    pricing = {
        "openai": {
            "gpt-4o": {"input": 2.50, "output": 5.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
            "gpt-3.5-turbo": {"input": 0.30, "output": 0.60},
            "o3": {"input": 2.00, "output": 8.00},
            "o3-pro": {"input": 20.00, "output": 80.00}
        },
        "anthropic": {
            "claude-4-opus": {"input": 15.00, "output": 75.00},
            "claude-4-sonnet": {"input": 3.00, "output": 15.00},
            "claude-4-haiku": {"input": 1.00, "output": 5.00}
        },
        "google": {
            "gemini-2.5-pro": {"input": 1.25, "output": 10.00},
            "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
            "gemini-1.5-pro": {"input": 0.0781, "output": 0.3125}
        },
        "deepseek": {
            "deepseek-r1": {"input": 0.55, "output": 2.19},
            "deepseek-v3": {"input": 0.55, "output": 2.19}
        }
    }
    
    provider_pricing = pricing.get(provider.lower())
    if not provider_pricing:
        return {"error": f"Unknown provider: {provider}"}
    
    model_pricing = provider_pricing.get(model.lower())
    if not model_pricing:
        return {"error": f"Unknown model: {model} for provider {provider}"}
    
    input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
    output_cost = (output_tokens / 1_000_000) * model_pricing["output"]
    total_cost = input_cost + output_cost
    
    return {
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": round(input_cost, 6),
        "output_cost": round(output_cost, 6),
        "total_cost": round(total_cost, 6),
        "pricing_per_1m_input": model_pricing["input"],
        "pricing_per_1m_output": model_pricing["output"]
    }

async def main():
    """Main entry point"""
    # Initialize database
    init_database()
    
    # Run MCP server
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="finops-mcp",
                server_version="1.0.0",
                capabilities=server.get_capabilities()
            )
        )

if __name__ == "__main__":
    asyncio.run(main())




