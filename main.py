import os
import ipaddress
from flask import Flask, request, jsonify, send_from_directory
import requests
import pygeohash as geohash
from flask_cors import CORS

TM_API_KEY = os.environ.get("TM_API_KEY")
IPINFO_TOKEN = os.environ.get("IPINFO_TOKEN")
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
app = Flask(__name__, static_folder="./frontend", static_url_path="/")
CORS(app)


def tm_get(path, params=None):
    if not TM_API_KEY:
        raise RuntimeError("TM_API_KEY is not configured")
    base = "https://app.ticketmaster.com/discovery/v2"
    if params is None:
        params = {}
    params["apikey"] = TM_API_KEY
    url = f"{base}/{path}"
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/ip-location")
def ip_location():
    if not IPINFO_TOKEN:
        return jsonify({"error": "IPINFO_TOKEN is not configured"}), 500

    forwarded_for = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    candidate_ip = forwarded_for or request.remote_addr or ""
    endpoint = "https://ipinfo.io/json"

    try:
        parsed_ip = ipaddress.ip_address(candidate_ip)
        if not (parsed_ip.is_private or parsed_ip.is_loopback):
            endpoint = f"https://ipinfo.io/{parsed_ip.compressed}/json"
    except ValueError:
        pass

    response = requests.get(endpoint, params={"token": IPINFO_TOKEN}, timeout=10)
    response.raise_for_status()
    location = response.json().get("loc")
    if not location:
        return jsonify({"error": "location was not found"}), 404
    return jsonify({"loc": location})


@app.route("/api/geocode")
def geocode_address():
    if not GOOGLE_MAPS_API_KEY:
        return jsonify({"error": "GOOGLE_MAPS_API_KEY is not configured"}), 500

    address = request.args.get("address", "").strip()
    if not address:
        return jsonify({"error": "missing address"}), 400

    response = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": address, "key": GOOGLE_MAPS_API_KEY},
        timeout=10,
    )
    response.raise_for_status()
    result = response.json().get("results", [])
    if not result:
        return jsonify({"error": "address was not found"}), 404
    return jsonify(result[0]["geometry"]["location"])

@app.route("/api/search")
def search():
    keyword = request.args.get("keyword", "").strip()
    distance = request.args.get("distance", "10").strip() or "10"
    segment_id = request.args.get("segmentId", "").strip() or None
    lat = request.args.get("lat")
    lng = request.args.get("lng")

    if not keyword or not lat or not lng:
        return jsonify({"error": "missing required parameters"}), 400

    geo = geohash.encode(float(lat), float(lng), 7)
    params = {
        "keyword": keyword,
        "radius": distance,
        "unit": "miles",
        "geoPoint": geo,
        "size": 20
    }
    if segment_id:
        params["segmentId"] = segment_id

    data = tm_get("events.json", params)
    return jsonify(data)

@app.route("/api/event")
def event_details():
    event_id = request.args.get("id")
    if not event_id:
        return jsonify({"error": "missing id"}), 400
    data = tm_get(f"events/{event_id}.json")
    return jsonify(data)

@app.route("/api/venue")
def venue_search():
    venue_id = request.args.get("id", "").strip()
    keyword  = request.args.get("keyword", "").strip()

    if venue_id:
        data = tm_get(f"venues/{venue_id}.json", {})
        return jsonify(data)

    if keyword:
        data = tm_get("venues.json", {"keyword": keyword})
        return jsonify(data)

    return jsonify({"error": "missing id or keyword"}), 400

@app.route("/api/sample")
def sample_entry():
    return jsonify({"entry": "/api/sample", "params": {"ping": "ok"}})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
