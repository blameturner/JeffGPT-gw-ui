# JeffGPT — MST AG Frontend + Gateway

Personal project. Gateway + frontend for the MST AG harness.

This is incredibly Claude Coded and I make no apologies because I was lazy.

I will be tinkering with it and improving it myself later until AGI comes in 2055

## Server compose

Append this to the existing server `docker-compose.yml`. Assumes `mst-ag-01-network` is already defined.

```yaml
services:
  mst-ag-gateway:
    image: ghcr.io/blameturner/mst-ag-gateway:latest
    container_name: mst-ag-gateway
    environment:
      - PORT=3900
      - HARNESS_URL=http://harness.url
      - NOCODB_URL=http://nocodb:8080
      - NOCODB_TOKEN=your_token
      - NOCODB_BASE_ID=your_base_id
      - BETTER_AUTH_SECRET=your_secret
      - BETTER_AUTH_URL=http://localhost:3900
      - DATABASE_URL=file:/data/auth.db
      - ALLOW_REGISTRATION=true
      - ENVIRONMENT=production
    volumes:
      - ./data/auth:/data
    ports:
      - "3900:3900"
    restart: unless-stopped
    networks:
      - mst-ag-01-network

  mst-ag-frontend:
    image: ghcr.io/blameturner/mst-ag-frontend:latest
    container_name: mst-ag-frontend
    environment:
      - VITE_GATEWAY_URL=http://100.96.243.61:3900
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - mst-ag-01-network

networks:
  mst-ag-01-network:
    external: true
```

