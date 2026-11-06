
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files and folders
COPY . .

# Create database storage directory
RUN mkdir -p /app/data

# Configure application port
ENV PORT=8080

EXPOSE 8080

# Start the FastAPI application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
