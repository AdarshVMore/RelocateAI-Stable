# --- Build the React frontend ---
FROM node:20-slim AS frontend
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# Render passes service environment variables to the build as build args
ARG REACT_APP_GOOGLE_MAPS_API_KEY
ARG REACT_APP_GEMINI_API_KEY_NEW
ENV REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY \
    REACT_APP_GEMINI_API_KEY_NEW=$REACT_APP_GEMINI_API_KEY_NEW
RUN npm run build

# --- Flask backend serving the API and the built frontend ---
FROM python:3.13-slim
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./
COPY --from=frontend /app/client/build /app/client/build
ENV FLASK_ENV=production PORT=10000
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
