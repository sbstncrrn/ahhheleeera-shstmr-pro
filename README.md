
# 🔥 Ahhheleeera Shstmr Pro - Optimizador de Rutas de Reparto

Aplicación web interactiva diseñada para la optimización de rutas de logística y entrega de paquetes, integrada con **Leaflet.js**, **OpenStreetMap** y enlaces directos a **Google Maps / Android Auto**.

## 🚀 Características
- **Optimización de Ruta:** Algoritmo del Vecino Más Cercano (Nearest Neighbor) basado en la fórmula de Haversine para la distancia ortodrómica.
- **Geocodificación Gratuita:** Integración con la API pública de Nominatim (OpenStreetMap).
- **Mapa Interactivo:** Visualización de paradas numeradas y trazado de rutas con Leaflet.js.
- **Navegación paso a paso:** Generación de Deep Links a Google Maps compatibles con la proyección en Android Auto.

## 🛠️ Tecnologías Utilizadas
- **HTML5 & CSS3:** Interfaz adaptativa en modo oscuro con gráficos vectoriales SVG animados.
- **JavaScript (Vanilla ES6+):** Procesamiento asíncrono (`async/await`) y manipulaciones DOM.
- **Leaflet.js v1.9.4:** Renderizado de mapas y marcadores geográficos.

## 📁 Estructura del Código
El proyecto es de tipo Single Page Application (SPA) contenido en `index.html`:
- `geocodificarDireccion()`: Consulta asíncrona a la API de Nominatim.
- `optimizarRuta()`: Algoritmo de resolución del problema del viajante (TSP).
- `renderizarRuta()`: Actualización visual del mapa Leaflet y la lista de paradas.
- `abrirGoogleMaps()`: Disparador de navegación GPS hacia Google Maps.

## 🤝 Cómo Contribuir
1. Realiza un *Fork* de este repositorio.
2. Crea una rama con tu nueva función: `git checkout -b feature/nueva-mejora`
3. Guarda tus cambios: `git commit -m 'Añade nueva funcionalidad'`
4. Envía un *Push* a la rama: `git push origin feature/nueva-mejora`
5. Abre un *Pull Request*.
