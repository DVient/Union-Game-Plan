Project: Superstat Basketball Player Development Report Generator
1. Objective
Build a simple application that connects to the Superstat Sport API and automatically generates individual basketball player development reports.
The application is intended for a non-technical basketball coach.
Its purpose is to:
• Identify player strengths and weaknesses.
• Evaluate statistical performance.
• Identify recurring patterns in game events.
• Assess scoring efficiency and decision-making.
• Recommend specific development priorities.
• Track improvement over time.
This is a player development tool, not an NCAA recruiting prediction system.
2. First Task: API and Platform Audit
Before writing code, review the official documentation:
https://help.superstatsport.com/docs/api-reference
API base URL: https://api.superstatsport.com
Identify the exact available endpoints and fields for:
• Clubs, teams and rosters.
• Matches.
• Player box scores.
• Play-by-play events.
• Individual player insights.
• Team insights.
Also investigate existing Superstat features that may already provide equivalent functionality.
Obtain a club API key as part of this stage: the API is free for every club, and the key is created by the club owner in the Superstat app under Settings → API keys (admins and editors cannot create keys). Until the key is created, the audit is documentation-only — the documentation audit is complete (see audit/capability-assessment.md). If the owner cannot create a key, stop and reassess the project before building further.
Produce a short capability assessment identifying:
• Available data.
• Metrics that can be calculated.
• Metrics that cannot be calculated.
• API limitations.
• Authentication requirements.
• A mapping of each planned report section (section 10) to the data that feeds it.
Do not assume undocumented endpoints or data fields exist.
3. Application Architecture and Runtime Model
The application runs entirely on the coach's Windows PC.
• The coach starts it with a single desktop shortcut; it opens its interface in the default web browser at a localhost address, reachable only from that machine.
• The Superstat API key, cached API responses, calculated statistics, saved reports and all stored data live on that PC.
• Reports are generated locally. The coach views, downloads and prints the PDF from the same machine.
• No external hosting, no user accounts, no cloud storage.
4. Technology Stack
• Backend: Node.js with TypeScript and a lightweight web framework serving the local-only interface.
• Storage: SQLite database file on the coach's PC, holding raw API responses, computed statistics and report snapshots.
• Frontend: web interface served locally by the app and opened in the coach's default browser.
• PDF: locally generated print-quality A4 documents via a mature PDF library.
• AI: provider-agnostic interface (section 8); concrete provider chosen in Stage 4.
• Keep dependencies minimal. No dashboards, admin panels or features beyond the core workflow.
5. API Integration
Build a secure connection using the club API key.
Retrieve and organize:
• Player information.
• Team information.
• Match information.
• Box scores.
• Play-by-play events.
• Player insights.
Store API credentials securely on the coach's PC only.
Preserve original API responses so reports can be regenerated without unnecessary API calls.
Handle missing data and API errors gracefully.
Data sync is manual: the coach clicks "Sync now" and the app incrementally fetches new matches and results since the last sync. Respect API rate limits and prefer cached responses over re-fetching.
6. Player Selection
Create a simple interface allowing the coach to:
1. Select a team.
2. Select a player.
3. Select games to evaluate.
4. Generate a report.
5. Download the report as a PDF.
6. Access previous reports.
Allow selection of the last 3, 5 or 10 games, or all available games.
Allow individual games to be excluded.
7. Statistical Analysis
Calculate the following metrics where the API provides the necessary data:
• Points and minutes per game.
• FG%, 3P% and FT%.
• Effective FG%.
• True Shooting %.
• Points per FGA.
• Assists and turnovers per game.
• Assist-to-turnover ratio.
• Rebounds, steals and blocks per game.
• Shooting distribution by court location.
• Performance consistency across games.
• Changes between reporting periods.
Insufficient-sample rules: with fewer than 5 games, fewer than 20 shot attempts behind any shooting percentage, or fewer than 10 combined assists and turnovers, mark the affected metric as low-confidence and draw no conclusions from it.
Validate calculated statistics against Superstat's box scores.
Do not invent unavailable metrics.
Do not calculate usage rate, contested shot percentages, live-ball turnover percentages or defensive efficiency unless all required underlying data is available.
Clearly identify estimated metrics and insufficient sample sizes.
8. AI Basketball Analysis
The AI provider sits behind a provider-agnostic interface so it can be replaced without touching analysis logic. The concrete provider is chosen in Stage 4. Its API key is stored on the coach's PC only.
The AI receives only a prepared evidence pack: validated statistics, box scores, play-by-play summaries and Superstat insights. It never receives API credentials or unrestricted raw data.
Use one AI analysis process to evaluate:
Scoring
• Shooting efficiency.
• Shot distribution.
• Shot selection.
• Scoring consistency.
Ball handling and decision-making
• Turnover frequency.
• Recorded turnover patterns.
• Assist-to-turnover ratio.
• Playmaking contribution.
Offensive contribution
• Scoring production.
• Assists.
• Efficiency.
• Consistency.
Defensive contribution
• Steals.
• Blocks.
• Defensive rebounds.
• Superstat's defensive insights.
Basketball IQ
• Recurring patterns identifiable through recorded events.
• Superstat's player insights.
• Potential decision-making weaknesses supported by evidence.
Use AI insights as supporting evidence, not unquestionable conclusions.
Every AI conclusion must cite the specific statistic, event or insight that supports it. Unsupported claims are removed before the report is written.
If the AI provider is unavailable, report generation pauses with a clear message; statistical sections still render from cached data.
Do not claim to evaluate video, defensive positioning, athleticism, processing speed or contested shots unless the necessary data is actually available.
Distinguish between confirmed findings, possible explanations and unverified observations.
9. Development Recommendations
Identify the player's three highest-priority development areas.
For each area, provide:
1. Identified weakness.
2. Supporting statistical or event evidence.
3. Why it matters.
4. Specific basketball development recommendations.
5. How improvement should be measured.
6. Suggested reassessment period.
Recommendations must be practical, specific and age-appropriate.
Avoid generic advice.
10. PDF Report Structure
Generate a professional, easy-to-understand PDF containing:
1. Player performance overview.
2. Statistical summary.
3. Identified strengths.
4. Identified weaknesses.
5. Scoring and shot selection analysis.
6. Turnover and playmaking analysis.
7. Defensive contribution.
8. Superstat AI insight review.
9. Three development priorities.
10. Recommended improvement measurements.
11. Data limitations and confidence assessment.
Write in straightforward language appropriate for a 14–15-year-old basketball player.
Every substantive conclusion must be supported by available evidence.
The PDF is generated locally by the app and can be viewed, saved and printed from the coach's PC.
11. Progress Tracking
Save previous reports and allow comparisons between reporting periods.
Each saved report is an immutable snapshot: the selected game set, the computed statistics, the AI analysis text and the PDF. Comparisons run only between snapshots. Regenerating a report with a different game set creates a new snapshot; nothing is overwritten.
Identify:
• Improvements.
• Declines.
• Unchanged performance.
• New weaknesses.
• Previously identified weaknesses that have improved.
Account for differences in minutes, competition and sample size.
12. Youth Data Privacy and Safeguarding
The subject is a minor (14–15 years old).
• All player data and reports stay on the coach's PC. Nothing is published or shared with third parties beyond the Superstat API and the chosen AI provider, which are required to operate the app.
• Minimize personal data in AI prompts: use the player's first name or initials and send statistics, never contact details or biographical information.
• Report language must be development-focused and strengths-based. No shaming, and no medical or psychological claims.
• Provide a simple way to permanently delete a player's data and reports.
13. Development Requirements
Build in stages:
Stage 1: API and existing Superstat feature audit, including requesting and obtaining the club API key.
Stage 2: Local application with secure API connection and player/game selection interface.
Stage 3: Data collection and statistical calculations.
Stage 4: AI basketball analysis, including choosing the AI provider.
Stage 5: PDF report generation.
Stage 6: Historical comparison and progress tracking.
Start with five completed games as the prototype.
Do not build unnecessary dashboards, multiple AI agents or advanced features before the core report works.
14. Testing and Acceptance Criteria
Before completion:
• Verify API authentication.
• Verify correct player and match attribution.
• Validate calculations against Superstat box scores.
• Verify event data accuracy.
• Test missing and incomplete data.
• Ensure AI conclusions are evidence-supported.
• Test reports across multiple games.
• Test historical comparisons.
• Verify PDF generation, viewing and printing on the coach's PC.
• Confirm API credentials remain secure and never leave the coach's PC.
• Confirm the non-technical coach completes the full workflow unassisted.
• Verify report language is readable for a 14–15-year-old.
Produce a working demonstration report using real Superstat data.
Do not declare completion until the complete workflow has been successfully tested.
15. Operating Principle
The coach is non-technical.
The finished application must require no programming, API configuration or prompt engineering during normal use, and the coach never handles API keys or configuration. Starting the app is a single shortcut.
The entire workflow, performed on the coach's PC, should be:
Select player → Select games → Generate report → Download PDF.
Prioritize accuracy, usability and actionable basketball development recommendations over technical complexity.
