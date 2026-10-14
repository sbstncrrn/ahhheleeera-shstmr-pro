# 🔥 Ahhheleeera Shstmr Pro - Optimizador de Rutas de Reparto (PWA v1.3.0)

Aplicación web progresiva (PWA) e interactiva diseñada para la optimización de rutas de logística y entrega de paquetes, integrada con **TomTom Traffic API**, **Leaflet.js**, **Waze**, **Google Maps / Android Auto** y un **Callejero con Autocompletado**.

---

## 🚀 Características Principales

- **Tráfico en Tiempo Real:** Integración con TomTom Matrix Routing API para calcular la secuencia óptima considerando la congestión vehicular en vivo.
- **Callejero Inteligente:** Buscador dinámico con autocompletado en tiempo real sobre la red vial de Chile (OpenStreetMap / Nominatim).
- **Soporte PWA Instalable:** Funciona como aplicación independiente en la pantalla de inicio de Android e iOS mediante Service Worker y Web App Manifest.
- **Multinavegador GPS:** Conexión directa a través de Deep Links con Google Maps (compatible con Android Auto / CarPlay) y Waze.
- **Controles de Reparto:** Reordenamiento manual de paradas (`🔼`/`🔽`), casillas de verificación ("Repartido / Entregado") y marcadores dinámicos de estado verde en el mapa.
- **Persistencia Local (`localStorage`):** Guardado automático del estado de la lista de paquetes, preferencias de GPS y la clave API de TomTom.

---

## 📂 Estructura del Repositorio

```text
ahhheleeera-shstmr-pro/
├── index.html     # Estructura de la Single Page Application (SPA) y contenedores
├── styles.css     # Estilos CSS3 en modo oscuro, mapa y animaciones SVG
├── app.js         # Lógica principal, TomTom Traffic API, Leaflet y Callejero
├── manifest.json  # Configuración para instalación PWA en dispositivos móviles
├── sw.js          # Service Worker para gestión de caché offline
└── README.md      # Documentación técnica del proyecto
