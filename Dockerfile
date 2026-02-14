# Stage 1: Clone sibling packages needed for Vite aliases and file: deps
FROM alpine/git AS deps

WORKDIR /deps
RUN git clone --depth 1 https://github.com/HubDev-AI/mklyml.git mkly && \
    git clone --depth 1 https://github.com/HubDev-AI/mklyml-kits.git mkly-kits && \
    git clone --depth 1 https://github.com/HubDev-AI/mklyml-plugins.git mkly-plugins

# Stage 2: Build the editor
FROM oven/bun:1 AS build

WORKDIR /app

# Copy sibling packages from clone stage
COPY --from=deps /deps/mkly/ mkly/
COPY --from=deps /deps/mkly-kits/ mkly-kits/
COPY --from=deps /deps/mkly-plugins/ mkly-plugins/

# Copy editor source from build context
COPY . mkly-editor/

# Install dependencies for each package
WORKDIR /app/mkly
RUN bun install

WORKDIR /app/mkly-kits
RUN bun install

WORKDIR /app/mkly-plugins
RUN bun install

WORKDIR /app/mkly-editor
RUN bun install

# Build the editor (produces dist/)
RUN bun run build

# Stage 3: Serve with nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mkly-editor/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off; worker_processes 2;"]
