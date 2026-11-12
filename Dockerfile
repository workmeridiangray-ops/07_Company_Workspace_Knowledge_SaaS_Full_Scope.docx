FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN NODE_OPTIONS=--disable-warning=ExperimentalWarning npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_FILE=/data/app.db NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY --from=build /app ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm","start"]
