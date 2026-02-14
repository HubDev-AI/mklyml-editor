# Stage 1: Build
# The build context is the workspace root (workspace/)
# because the editor imports from sibling packages via Vite aliases.
#
# Build command (from workspace root):
#   docker build -f milkly-mklyml/mkly-editor/Dockerfile -t mkly-editor .
#
# Run:
#   docker run -p 8080:80 mkly-editor
#
FROM oven/bun:1 AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY milkly-mklyml/mkly/package.json mkly/
COPY milkly-mklyml/mkly-kits/package.json mkly-kits/
COPY milkly-mklyml/mkly-kits/newsletter/package.json mkly-kits/newsletter/
COPY milkly-mklyml/mkly-kits/docs/package.json mkly-kits/docs/
COPY milkly-mklyml/mkly-plugins/package.json mkly-plugins/
COPY milkly-mklyml/mkly-plugins/email/package.json mkly-plugins/email/
COPY milkly-mklyml/mkly-editor/package.json mkly-editor/

# Install dependencies for each package
WORKDIR /app/mkly
RUN bun install

WORKDIR /app/mkly-kits
RUN bun install

WORKDIR /app/mkly-plugins
RUN bun install

WORKDIR /app/mkly-editor
RUN bun install

# Copy source code (only what Vite needs to bundle)
WORKDIR /app
COPY milkly-mklyml/mkly/src/ mkly/src/
COPY milkly-mklyml/mkly-kits/newsletter/src/ mkly-kits/newsletter/src/
COPY milkly-mklyml/mkly-kits/docs/src/ mkly-kits/docs/src/
COPY milkly-mklyml/mkly-plugins/email/src/ mkly-plugins/email/src/
COPY milkly-mklyml/mkly-plugins/docs/src/ mkly-plugins/docs/src/
COPY milkly-mklyml/mkly-plugins/seo/src/ mkly-plugins/seo/src/
COPY milkly-mklyml/mkly-plugins/newsletter-ai/src/ mkly-plugins/newsletter-ai/src/
COPY milkly-mklyml/mkly-editor/src/ mkly-editor/src/
COPY milkly-mklyml/mkly-editor/index.html mkly-editor/
COPY milkly-mklyml/mkly-editor/vite.config.ts mkly-editor/
COPY milkly-mklyml/mkly-editor/tsconfig.json mkly-editor/

# Build the editor (produces mkly-editor/dist/)
WORKDIR /app/mkly-editor
RUN bun run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY milkly-mklyml/mkly-editor/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mkly-editor/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
