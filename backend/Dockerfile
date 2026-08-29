# Backend Dockerfile — Node.js with JADX + Ghidra bundled
FROM node:22-bookworm-slim

# Install Java (required by JADX + Ghidra)
RUN apt-get update && apt-get install -y \
    openjdk-17-jre-headless \
    wget unzip curl \
    && rm -rf /var/lib/apt/lists/*

# Install JADX
ARG JADX_VERSION=1.5.0
RUN wget -q "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" \
    -O /tmp/jadx.zip \
    && unzip -q /tmp/jadx.zip -d /opt/jadx \
    && chmod +x /opt/jadx/bin/jadx \
    && rm /tmp/jadx.zip

# Install Ghidra
ARG GHIDRA_VERSION=11.1.2
ARG GHIDRA_DATE=20240709
RUN wget -q "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}_build/ghidra_${GHIDRA_VERSION}_PUBLIC_${GHIDRA_DATE}.zip" \
    -O /tmp/ghidra.zip \
    && unzip -q /tmp/ghidra.zip -d /opt \
    && mv /opt/ghidra_${GHIDRA_VERSION}_PUBLIC /opt/ghidra \
    && chmod +x /opt/ghidra/support/analyzeHeadless \
    && rm /tmp/ghidra.zip

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node deps
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Create directories
RUN mkdir -p uploads outputs ghidra_projects data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
    CMD curl -f http://localhost:3001/api/health || exit 1

EXPOSE 3001

CMD ["node", "src/app.js"]
