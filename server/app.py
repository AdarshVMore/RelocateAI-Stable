from flask import Flask, jsonify, session, request, send_from_directory
from flask_cors import CORS
from routes.auth_routes import auth_bp
from routes.housing_routes import housing_bp
from routes.user_routes import user_routes
from routes.upload_routes import upload_routes  # Import missing routes
from routes.chatbot_routes import chatbot_bp  # Import missing routes
from routes.social_routes import social_blueprint

import os
from datetime import timedelta

# Create necessary directories
os.makedirs("uploads", exist_ok=True)

# Built React app, served by Flask in production
FRONTEND_BUILD_DIR = os.getenv(
    "FRONTEND_BUILD_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "client", "build"),
)

app = Flask(__name__, static_folder=None)  # /static belongs to the React build

# Configure session
app.secret_key = os.getenv("SECRET_KEY", "your_secret_key_here")
app.config['SESSION_COOKIE_SECURE'] = os.getenv("FLASK_ENV") == "production"
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Session lasts for 7 days

# Enable CORS with session support
# When using credentials, we can't use wildcard origins
CORS(app, 
     origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]
     + [o for o in os.getenv("CORS_ORIGINS", "").split(",") if o],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Handle OPTIONS requests for CORS preflight
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return '', 200

# Register authentication routes
app.register_blueprint(auth_bp, url_prefix="/api/auth")  # 🔹 Added "/api/auth"

# Register user routes
app.register_blueprint(user_routes, url_prefix="/api/user")

# Register file upload routes
app.register_blueprint(upload_routes, url_prefix="/api")  # 🔹 Added "/api"

# Register housing routes
app.register_blueprint(housing_bp, url_prefix="/api/housing")

# Register chatbot routes
app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")

# Register Blueprints
app.register_blueprint(social_blueprint, url_prefix="/social")


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"message": "API is working!"}), 200

@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def serve_frontend(path):
    # Serve the React build; unknown paths fall back to index.html for client-side routing
    if not os.path.isdir(FRONTEND_BUILD_DIR):
        return jsonify({"message": "API is working!"}), 200
    if path and os.path.isfile(os.path.join(FRONTEND_BUILD_DIR, path)):
        return send_from_directory(FRONTEND_BUILD_DIR, path)
    return send_from_directory(FRONTEND_BUILD_DIR, "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=3000)