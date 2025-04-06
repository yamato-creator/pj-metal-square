# ビルドステージ
FROM node:18 as builder

WORKDIR /app

# ソースマップを無効化
ENV GENERATE_SOURCEMAP=false

ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 実行ステージ
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

ENV PORT=3000
ENV REACT_APP_API_URL=$REACT_APP_API_URL

CMD sh -c "envsubst '\$PORT \$REACT_APP_API_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"