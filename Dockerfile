# Image de la tranche verticale (ADR 0014) : construit l'API et le front, puis
# l'API sert les deux sur un seul port. Même base que la CI (node:24-trixie).
FROM node:24-trixie

WORKDIR /app

# Dépendances d'abord : cette couche reste en cache tant que les package.json
# ne changent pas. Les scripts (husky) n'ont pas de sens dans l'image.
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --ignore-scripts

COPY api api
COPY web web
RUN npm run build

# Les secrets ne sont jamais copiés : compose lit api/.env au démarrage
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "api/dist/index.js"]
