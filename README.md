# 🔥 Ahhheleeera Shstmr Pro - Optimizador de Rutas de Reparto

Aplicación web interactiva y modular diseñada para la optimización de rutas de logística y entrega de paquetes, integrada con **Leaflet.js**, **OpenStreetMap**, almacenamiento local persistente y enlaces directos a **Google Maps / Android Auto**.

---

## 🚀 Características Principales

- **Optimización de Ruta:** Algoritmo del Vecino Más Cercano (Nearest Neighbor) basado en la fórmula de Haversine para encontrar la secuencia de reparto más rápida.
- **Geocodificación Asíncrona:** Consulta pública a la API de Nominatim (OpenStreetMap).
- **Mapa Interactivo:** Marcadores numerados dinámicos con trazado de polyline mediante Leaflet.js.
- **Reordenamiento Manual:** Cambia el orden de los paquetes en tiempo real usando botones `🔼` / `🔽` o mediante arrastrar y soltar (*Drag & Drop*).
- **Control de Estado de Entregas:** Marca paquetes como "Repartido / Entregado" con cambio visual en tarjetas y marcadores verdes en el mapa.
- **Persistencia de Datos (`localStorage`):** Restaura automáticamente la lista y el estado de reparto al recargar la página o reabrir el navegador.
- **Integración con Android Auto & iOS:** Generación de enlaces compatibles con Google Maps en Android y Safari en iOS.

---

## 📂 Estructura del Proyecto

El código está organizado de forma modular para facilitar su mantenimiento y desarrollo colaborativo:

```text
ahhheleeera-shstmr-pro/
├── index.html   # Estructura HTML5 y contenedores principales
├── styles.css   # Estilos CSS3, modo oscuro y animaciones SVG
└── app.js       # Lógica JavaScript (Algoritmos, Leaflet, Eventos y localStorage)
