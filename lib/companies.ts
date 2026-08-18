/**
 * Suggestions for the company field.
 *
 * Deliberately a plain list feeding a native <datalist>: it filters as the
 * user types, stays fully keyboard accessible, and — most importantly — never
 * constrains the value. Anything not on this list can still be typed.
 *
 * Weighted toward Canadian employers, since that is where the outreach is
 * happening, then the large global tech, finance and consulting names people
 * most often reach into.
 */
export const COMPANY_SUGGESTIONS: string[] = [
  // Canadian banks and financial services
  "RBC", "TD Bank", "Scotiabank", "BMO", "CIBC", "National Bank of Canada",
  "Desjardins", "EQ Bank", "Tangerine", "Sun Life", "Manulife", "Canada Life",
  "Intact Financial", "Definity", "Onex", "Brookfield", "CPP Investments",
  "Ontario Teachers' Pension Plan", "OMERS", "PSP Investments", "CDPQ",
  "Wealthsimple", "Questrade", "Neo Financial", "KOHO", "Borrowell", "Float",

  // Canadian technology
  "Shopify", "Telus", "Rogers", "Bell", "OpenText", "Constellation Software",
  "Lightspeed", "Nuvei", "Clio", "Dayforce", "Kinaxis", "Coveo", "Hootsuite",
  "Faire", "Cohere", "Ada", "Wattpad", "ecobee", "Jane Software", "Vidyard",
  "Thinkific", "Later", "1Password", "Axonify", "Miovision", "Bench",

  // Canadian industry and consumer
  "Air Canada", "WestJet", "Loblaw", "Canadian Tire", "Metro", "Empire",
  "Lululemon", "Aritzia", "Canada Goose", "Roots", "Bombardier", "CN",
  "Canadian Pacific Kansas City", "Enbridge", "Suncor", "Cenovus", "TC Energy",
  "Magna International", "Linamar", "Thomson Reuters", "Nutrien", "Teck",
  "Barrick Gold", "Agnico Eagle", "Saputo", "Couche-Tard",

  // Consulting, accounting and law
  "Deloitte", "PwC", "EY", "KPMG", "McKinsey & Company",
  "Boston Consulting Group", "Bain & Company", "Accenture", "Oliver Wyman",
  "Kearney", "Roland Berger", "ZS Associates", "Slalom", "Gartner",

  // Global banking and investment
  "Goldman Sachs", "Morgan Stanley", "JPMorgan Chase", "Bank of America",
  "Citi", "Wells Fargo", "Barclays", "HSBC", "UBS", "Deutsche Bank",
  "BNP Paribas", "Jefferies", "Evercore", "Lazard", "Houlihan Lokey",
  "Rothschild & Co", "Moelis & Company", "Blackstone", "KKR", "Apollo",
  "Carlyle", "TPG", "Warburg Pincus", "General Atlantic", "Vista Equity",
  "BlackRock", "Vanguard", "Fidelity", "State Street", "Citadel",
  "Jane Street", "Two Sigma", "Point72", "Bridgewater Associates",
  "Hudson River Trading", "Optiver", "IMC Trading", "DRW", "Susquehanna",

  // Big technology
  "Google", "Microsoft", "Amazon", "Apple", "Meta", "Netflix", "NVIDIA",
  "Tesla", "IBM", "Oracle", "Salesforce", "Adobe", "Intel", "AMD",
  "Qualcomm", "Cisco", "SAP", "ServiceNow", "Workday", "Intuit", "PayPal",
  "Block", "Stripe", "Uber", "Lyft", "Airbnb", "DoorDash", "Instacart",
  "Snowflake", "Databricks", "Palantir", "Datadog", "MongoDB", "Atlassian",
  "Twilio", "Zoom", "Dropbox", "Figma", "Canva", "Notion", "Linear",
  "Vercel", "Supabase", "GitHub", "GitLab", "HashiCorp", "Cloudflare",
  "Elastic", "Confluent", "Asana", "Miro", "Airtable", "Samsara", "Rippling",
  "Ramp", "Brex", "Plaid", "Deel", "Gusto", "Klarna", "Revolut", "Wise",
  "Robinhood", "Coinbase", "Affirm",

  // AI
  "OpenAI", "Anthropic", "Hugging Face", "Scale AI", "Mistral AI",
  "Perplexity", "Runway", "Midjourney",

  // Healthcare and pharma
  "Johnson & Johnson", "Pfizer", "Moderna", "Merck", "AstraZeneca", "GSK",
  "Roche", "Novartis", "Sanofi", "Eli Lilly", "Abbott", "Medtronic",
  "Bayer", "Amgen",

  // Industrial, aerospace and automotive
  "Boeing", "Airbus", "Lockheed Martin", "RTX", "Northrop Grumman",
  "General Electric", "Siemens", "Honeywell", "3M", "Caterpillar", "Deere",
  "ABB", "Schneider Electric", "Toyota", "Ford", "General Motors",
  "Stellantis", "Rivian", "BMW", "Mercedes-Benz", "Volkswagen",

  // Consumer, retail and media
  "Procter & Gamble", "Unilever", "Nestle", "PepsiCo", "Coca-Cola",
  "Mondelez", "Kraft Heinz", "L'Oreal", "Nike", "Adidas", "Walmart",
  "Costco", "Target", "The Home Depot", "IKEA", "McDonald's", "Starbucks",
  "Disney", "Warner Bros. Discovery", "Comcast", "Spotify", "Sony",
  "Electronic Arts", "Ubisoft", "Riot Games", "Epic Games",

  // Energy, real estate and professional services
  "Shell", "BP", "ExxonMobil", "Chevron", "TotalEnergies", "CBRE",
  "JLL", "Colliers", "Aon", "Marsh McLennan", "WTW", "Robert Half",
  "Randstad", "Indeed", "LinkedIn",
];
