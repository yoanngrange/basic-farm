FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8080

# The actual build (vite build + generate-static.mjs) happens at container
# START, not at image build time — it needs the API to be up and reachable
# to fetch listings/categories. docker-compose's command: override runs
# this; this default CMD is just a fallback if the image is run standalone.
CMD ["sh", "-c", "npm run build && npx --yes serve dist -l 8080 --config serve.json"]
