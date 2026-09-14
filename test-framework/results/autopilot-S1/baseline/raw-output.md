# AI Trend Learning App — Implementation Plan

## Features
- Dashboard showing trending AI/ML topics from social media (Twitter, Reddit, HN, LinkedIn, YouTube)
- Personalized learning path recommendations based on user skill level
- Skill tracking and progression
- Three deployment modes: self-hosted free, hosted SaaS, self-hosted private (enterprise)
- Team skill overview for enterprise mode
- User feedback on trends and resources

## Tech Stack
- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Cache/Queue:** Redis + BullMQ
- **LLM:** OpenAI API for trend synthesis and resource matching
- **Scraping:** Custom adapters per platform API
- **Deploy:** Docker Compose

## Data Model
- `users` — id, email, password_hash, role, deployment_mode, skill_profile (JSON), created_at
- `trends` — id, title, summary, signal_strength, subfields (array), sources (JSON), scraped_at
- `learning_resources` — id, title, url, format, difficulty, estimated_time, topic_tags
- `learning_paths` — id, user_id, trend_id, resources (ordered JSON array), created_at
- `user_progress` — id, user_id, resource_id, completed, rating, completed_at
- `teams` — id, name, owner_id
- `team_members` — team_id, user_id, role

## API Endpoints
- `GET /api/trends` — list trending topics (with filters)
- `GET /api/trends/:id` — trend detail with "why trending" explanation
- `POST /api/trends/:id/rate` — rate trend relevance
- `POST /api/trends/:id/learn` — generate learning path
- `GET /api/learning-paths/:id` — get learning path with resources
- `POST /api/resources/:id/complete` — mark resource completed
- `POST /api/resources/:id/rate` — rate resource quality
- `GET /api/profile` — get user skill profile
- `PUT /api/profile` — update skill self-assessment
- `GET /api/team/overview` — aggregate team skills (admin only)
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — login
- `POST /api/setup` — initial deployment configuration

## Implementation Plan

1. Set up monorepo with frontend/backend packages, Docker Compose config
2. Build database schema and migrations
3. Implement auth (JWT) with role-based access
4. Build platform scraper adapters (Twitter, Reddit, HN, LinkedIn, YouTube)
5. Create scrape scheduler (BullMQ cron job, daily)
6. Build trend synthesis service — aggregate signals, rank by frequency/recency
7. Implement trend API endpoints
8. Build learning path generator — call LLM with trend + user profile, return resources
9. Implement skill profile CRUD
10. Build frontend: trend dashboard, trend detail panel, learning path page
11. Add skill profile page with self-assessment and progress visualization
12. Implement feedback system (trend + resource ratings)
13. Add team overview page (admin only, enterprise mode)
14. Add deployment mode configuration (env var switches feature flags)
15. Write Dockerfile and docker-compose.yml for self-hosted deployment
16. Add multi-tenant isolation for hosted SaaS mode
17. Basic error handling and loading states
18. Manual testing across all three deployment modes
