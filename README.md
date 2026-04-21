# 3D-Transformations

An interactive educational web application built with Vanilla JS and Three.js to help learn and visualize 3D transformations.

**Live Demo:** [https://3d-transformations-gilt.vercel.app](https://3d-transformations-gilt.vercel.app)

## How to Run Locally

1. Clone the repository:
   ```bash
   git clone git@github.com:GurKalra/3D-Transformations.git
   ```
2. Navigate to the project directory:
   ```bash
   cd 3D-Transformations
   ```
3. Run a local web server. Since the project uses modern ES modules for importing libraries like Three.js, simply opening `index.html` in the browser will result in a CORS error. You can use any local static server to host the files:
   
   Using Node.js (`http-server`):
   ```bash
   npx http-server
   ```
   
   Or using Python 3:
   ```bash
   python -m http.server
   ```
   
4. Open your browser and navigate to the provided local URL (usually `http://127.0.0.1:8080` or `http://localhost:8000`).
