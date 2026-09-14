#!/usr/bin/env python3
"""
Cloud Cost Calculator - Interactive tool to estimate cloud hosting costs.

This script helps solo developers estimate costs across different platforms
and hosting options.
"""

import sys
from typing import Dict, List, Tuple

# Platform pricing data (monthly, USD)
PLATFORMS = {
    "hetzner": {
        "name": "Hetzner Cloud",
        "plans": {
            "CPX11": {"price": 4.50, "cpu": 2, "ram": 4, "storage": 80, "traffic": 20000},
            "CPX21": {"price": 9.00, "cpu": 3, "ram": 8, "storage": 160, "traffic": 20000},
            "CPX31": {"price": 18.00, "cpu": 4, "ram": 16, "storage": 240, "traffic": 20000},
        }
    },
    "aws": {
        "name": "AWS",
        "plans": {
            "t3.micro": {"price": 7.50, "cpu": 2, "ram": 1, "storage": 0, "traffic": 0},
            "t3.small": {"price": 15.00, "cpu": 2, "ram": 2, "storage": 0, "traffic": 0},
            "t3.medium": {"price": 30.00, "cpu": 2, "ram": 4, "storage": 0, "traffic": 0},
        }
    },
    "azure": {
        "name": "Azure",
        "plans": {
            "Free": {"price": 0.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
            "Basic": {"price": 13.00, "cpu": 1, "ram": 1.75, "storage": 0, "traffic": 0},
            "Standard": {"price": 50.00, "cpu": 2, "ram": 3.5, "storage": 0, "traffic": 0},
        }
    },
    "gcp": {
        "name": "Google Cloud Platform",
        "plans": {
            "e2-micro": {"price": 4.80, "cpu": 2, "ram": 1, "storage": 0, "traffic": 0},
            "e2-small": {"price": 9.60, "cpu": 2, "ram": 2, "storage": 0, "traffic": 0},
            "e2-medium": {"price": 19.20, "cpu": 2, "ram": 4, "storage": 0, "traffic": 0},
        }
    },
    "railway": {
        "name": "Railway",
        "plans": {
            "Hobby": {"price": 5.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
            "Pro": {"price": 20.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
        }
    },
    "render": {
        "name": "Render",
        "plans": {
            "Free": {"price": 0.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
            "Starter": {"price": 7.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
            "Professional": {"price": 25.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
        }
    },
    "vercel": {
        "name": "Vercel",
        "plans": {
            "Hobby": {"price": 0.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
            "Pro": {"price": 20.00, "cpu": 0, "ram": 0, "storage": 0, "traffic": 0},
        }
    },
}

def ask_question(question: str, options: List[Tuple[str, str]]) -> str:
    """Ask a question and return the selected option key."""
    print(f"\n{question}")
    print("-" * len(question))
    for i, (key, desc) in enumerate(options, 1):
        print(f"{i}. {desc}")
    
    while True:
        try:
            choice = input(f"\nEnter your choice (1-{len(options)}): ")
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx][0]
            print("Invalid choice. Please try again.")
        except (ValueError, KeyboardInterrupt):
            print("\nExiting...")
            sys.exit(0)

def calculate_costs(platform: str, plan: str, additional_services: Dict) -> Dict:
    """Calculate total monthly costs."""
    platform_data = PLATFORMS[platform]
    plan_data = platform_data["plans"][plan]
    
    base_cost = plan_data["price"]
    
    # Additional services
    database_cost = additional_services.get("database", 0)
    cdn_cost = additional_services.get("cdn", 0)
    email_cost = additional_services.get("email", 0)
    monitoring_cost = additional_services.get("monitoring", 0)
    
    total = base_cost + database_cost + cdn_cost + email_cost + monitoring_cost
    
    return {
        "platform": platform_data["name"],
        "plan": plan,
        "base_cost": base_cost,
        "database": database_cost,
        "cdn": cdn_cost,
        "email": email_cost,
        "monitoring": monitoring_cost,
        "total": total,
        "annual": total * 12
    }

def main():
    """Main cost calculator."""
    print("=" * 60)
    print("Cloud Cost Calculator")
    print("=" * 60)
    print("\nThis tool helps you estimate monthly cloud hosting costs.")
    print("Answer a few questions to get cost estimates.\n")
    
    # Select platform
    platform_options = [(key, data["name"]) for key, data in PLATFORMS.items()]
    platform = ask_question("Which platform are you considering?", platform_options)
    
    # Select plan
    plan_options = [(key, f"{key} (${data['price']:.2f}/month)") 
                   for key, data in PLATFORMS[platform]["plans"].items()]
    plan = ask_question("Which plan are you considering?", plan_options)
    
    # Additional services
    print("\n" + "=" * 60)
    print("Additional Services")
    print("=" * 60)
    
    database = ask_question("Database service?", [
        ("none", "None (included)"),
        ("supabase_free", "Supabase Free ($0/month)"),
        ("supabase_pro", "Supabase Pro ($25/month)"),
        ("planetscale", "PlanetScale ($29/month)"),
        ("azure_sql_free", "Azure SQL Free ($0/month)"),
        ("azure_sql_basic", "Azure SQL Basic ($5/month)"),
        ("cockroachdb", "CockroachDB Free ($0/month)"),
        ("fauna", "Fauna Free ($0/month)"),
        ("managed", "Managed Database ($50/month)"),
    ])
    
    database_costs = {
        "none": 0,
        "supabase_free": 0,
        "supabase_pro": 25,
        "planetscale": 29,
        "azure_sql_free": 0,
        "azure_sql_basic": 5,
        "cockroachdb": 0,
        "fauna": 0,
        "managed": 50,
    }
    
    cdn = ask_question("CDN service?", [
        ("none", "None"),
        ("cloudflare_free", "Cloudflare Free ($0/month)"),
        ("cloudflare_pro", "Cloudflare Pro ($20/month)"),
    ])
    
    cdn_costs = {
        "none": 0,
        "cloudflare_free": 0,
        "cloudflare_pro": 20,
    }
    
    email = ask_question("Email service?", [
        ("none", "None"),
        ("resend_free", "Resend Free ($0/month)"),
        ("resend_pro", "Resend Pro ($20/month)"),
        ("sendgrid", "SendGrid ($15/month)"),
    ])
    
    email_costs = {
        "none": 0,
        "resend_free": 0,
        "resend_pro": 20,
        "sendgrid": 15,
    }
    
    monitoring = ask_question("Monitoring service?", [
        ("none", "None"),
        ("sentry_free", "Sentry Free ($0/month)"),
        ("sentry_team", "Sentry Team ($26/month)"),
    ])
    
    monitoring_costs = {
        "none": 0,
        "sentry_free": 0,
        "sentry_team": 26,
    }
    
    # Calculate costs
    additional_services = {
        "database": database_costs[database],
        "cdn": cdn_costs[cdn],
        "email": email_costs[email],
        "monitoring": monitoring_costs[monitoring],
    }
    
    costs = calculate_costs(platform, plan, additional_services)
    
    # Display results
    print("\n" + "=" * 60)
    print("COST ESTIMATE")
    print("=" * 60)
    print(f"\nPlatform: {costs['platform']}")
    print(f"Plan: {costs['plan']}")
    print(f"\nMonthly Costs:")
    print(f"  Base Hosting: ${costs['base_cost']:.2f}")
    if costs['database'] > 0:
        print(f"  Database: ${costs['database']:.2f}")
    if costs['cdn'] > 0:
        print(f"  CDN: ${costs['cdn']:.2f}")
    if costs['email'] > 0:
        print(f"  Email: ${costs['email']:.2f}")
    if costs['monitoring'] > 0:
        print(f"  Monitoring: ${costs['monitoring']:.2f}")
    print(f"\n  Total Monthly: ${costs['total']:.2f}")
    print(f"  Total Annual: ${costs['annual']:.2f}")
    
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS")
    print("=" * 60)
    
    if costs['total'] == 0:
        print("\n✅ Great! You're using all free tiers.")
        print("This is perfect for MVP and early development.")
    elif costs['total'] < 25:
        print("\n✅ Low cost setup - great for solo developers!")
        print("Consider this for MVP and early launch phases.")
    elif costs['total'] < 100:
        print("\n⚠️  Moderate cost - good for growing apps.")
        print("Monitor usage and optimize as you scale.")
    else:
        print("\n💰 Higher cost - consider optimization opportunities:")
        print("  - Review if all services are necessary")
        print("  - Consider VPS alternatives")
        print("  - Optimize resource usage")
    
    print("\n")

if __name__ == "__main__":
    main()

