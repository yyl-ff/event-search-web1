# Event Search Web App

A full-stack event search application built with Flask and vanilla JavaScript. It searches Ticketmaster events by keyword, category, distance, and location, and displays event and venue details.

## Features

- Search for nearby events by keyword and category
- Resolve a typed address with Google Maps Geocoding
- Auto-detect an approximate location with IPinfo
- Sort results by event, genre, or venue
- View event details, ticket links, seat maps, and venue information

## Tech stack

- Python and Flask
- HTML, CSS, and vanilla JavaScript
- Ticketmaster Discovery API
- Google Maps Geocoding API
- IPinfo API
- Google App Engine configuration

## Run locally

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy the example environment settings and replace each placeholder with your own API credential:

   ```bash
   cp .env.example .env
   ```

4. Export the variables before starting the server:

   ```bash
   set -a
   source .env
   set +a
   python main.py
   ```

5. Open `http://localhost:8080`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `TM_API_KEY` | Ticketmaster Discovery API access |
| `IPINFO_TOKEN` | Approximate IP-based location lookup |
| `GOOGLE_MAPS_API_KEY` | Address geocoding |

Never commit real API credentials. Restrict each credential by API, origin, server, and quota wherever its provider supports those controls.

## Deployment

`app.yaml` contains the Google App Engine Python runtime and Gunicorn entry point. Configure the three environment variables securely in the deployment environment before deploying.

