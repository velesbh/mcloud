/**
 * Framework registry — mirrors `webcloud/src/lib/constants.ts FRAMEWORKS`.
 *
 * `build_image` runs the install + build phase, `runtime_image` serves the
 * artifact. Static sites build with node (for SSG) and serve with nginx;
 * runtime frameworks reuse the same image for both phases.
 */
export interface FrameworkSpec {
  id: string;
  label: string;
  build_image: string;
  runtime_image: string;
  default_install_cmd: string;
  default_build_cmd: string;
  default_output_dir: string;
  default_start_cmd: string;
  default_container_port: number;
}

export const FRAMEWORKS: Record<string, FrameworkSpec> = {
  static: {
    id: "static",
    label: "Static site",
    build_image: "node:20-alpine",
    runtime_image: "nginx:alpine",
    default_install_cmd: "npm install",
    default_build_cmd: "npm run build",
    default_output_dir: "dist",
    // nginx auto-serves /usr/share/nginx/html
    default_start_cmd: "cp -r /workspace/dist/. /usr/share/nginx/html/ && nginx -g 'daemon off;'",
    default_container_port: 80,
  },
  nodejs: {
    id: "nodejs",
    label: "Node.js",
    build_image: "node:20-alpine",
    runtime_image: "node:20-alpine",
    default_install_cmd: "npm ci",
    default_build_cmd: "npm run build",
    default_output_dir: ".",
    default_start_cmd: "npm start",
    default_container_port: 3000,
  },
  nextjs: {
    id: "nextjs",
    label: "Next.js",
    build_image: "node:20-alpine",
    runtime_image: "node:20-alpine",
    default_install_cmd: "npm ci",
    default_build_cmd: "npm run build",
    default_output_dir: ".next",
    default_start_cmd: "npm start",
    default_container_port: 3000,
  },
  python: {
    id: "python",
    label: "Python",
    build_image: "python:3.12-slim",
    runtime_image: "python:3.12-slim",
    default_install_cmd: "pip install -r requirements.txt",
    default_build_cmd: "true",
    default_output_dir: ".",
    default_start_cmd: "python app.py",
    default_container_port: 8000,
  },
  bun: {
    id: "bun",
    label: "Bun",
    build_image: "oven/bun:latest",
    runtime_image: "oven/bun:latest",
    default_install_cmd: "bun install",
    default_build_cmd: "bun run build",
    default_output_dir: ".",
    default_start_cmd: "bun start",
    default_container_port: 3000,
  },
  deno: {
    id: "deno",
    label: "Deno",
    build_image: "denoland/deno:latest",
    runtime_image: "denoland/deno:latest",
    default_install_cmd: "deno cache main.ts",
    default_build_cmd: "true",
    default_output_dir: ".",
    default_start_cmd: "deno run --allow-net --allow-env main.ts",
    default_container_port: 8000,
  },
  go: {
    id: "go",
    label: "Go",
    build_image: "golang:1.22-alpine",
    runtime_image: "alpine:latest",
    default_install_cmd: "go mod download",
    default_build_cmd: "go build -o app .",
    default_output_dir: ".",
    default_start_cmd: "./app",
    default_container_port: 8080,
  },
};

export function specFor(framework: string): FrameworkSpec {
  return FRAMEWORKS[framework] ?? FRAMEWORKS.static;
}
