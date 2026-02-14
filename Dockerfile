# Stage 1: Build
# The build context must be the monorepo root (milkly-mklyml/)
# because the editor imports from sibling packages via Vite aliases.
#
# Build command (from monorepo root):
#   docker build -f mkly-editor/Dockerfile -t mkly-editor .
#
# Run:
#   docker run -p 8080:80 mkly-editor
#
FROM oven/bun:1 AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY mkly/package.json mkly/
COPY mkly-kits/newsletter/package.json mkly-kits/newsletter/
COPY mkly-plugins/email/package.json mkly-plugins/email/
COPY mkly-editor/package.json mkly-editor/

# Install dependencies for each package
WORKDIR /app/mkly
RUN bun install

WORKDIR /app/mkly-kits/newsletter
RUN bun install

WORKDIR /app/mkly-plugins/email
RUN bun install

WORKDIR /app/mkly-editor
RUN bun install

# Copy source code (only what Vite needs to bundle)
WORKDIR /app
COPY mkly/src/ mkly/src/
COPY mkly-kits/newsletter/src/ mkly-kits/newsletter/src/
COPY mkly-plugins/email/src/ mkly-plugins/email/src/
COPY mkly-editor/src/ mkly-editor/src/
COPY mkly-editor/index.html mkly-editor/
COPY mkly-editor/vite.config.ts mkly-editor/
COPY mkly-editor/tsconfig.json mkly-editor/

# Build the editor (produces mkly-editor/dist/)
WORKDIR /app/mkly-editor
RUN bun run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY mkly-editor/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mkly-editor/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
