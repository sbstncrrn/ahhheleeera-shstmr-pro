# 🔥 Ahhheleeera Shstmr Pro - Optimizador de Rutas de Reparto (v1.4.0)

Aplicación web progresiva (PWA) diseñada para la optimización de rutas logísticas y entrega de paquetes. Integra análisis de tráfico en tiempo real, extracción de datos mediante Inteligencia Artificial y conectividad directa con plataformas de navegación y mensajería.

---

## 🚀 Características Principales

- **Escáner de Etiquetas con IA:** Integración con Google Gemini Vision para extraer automáticamente direcciones y números de teléfono desde fotografías de etiquetas de envío.
- **Tráfico en Tiempo Real:** Conexión con TomTom Matrix Routing API para calcular secuencias de entrega óptimas basadas en la congestión vehicular actual.
- **Notificaciones por WhatsApp:** Generación de enlaces profundos para enviar mensajes automáticos a clientes, sin necesidad de guardar el contacto en la agenda.
- **Perfiles de Enrutamiento:** Selector de modo de viaje (Automóvil / Bicicleta) que ajusta el algoritmo y la navegación en Google Maps y Waze.
- **Soporte PWA (App Instalable):** Arquitectura web progresiva que permite instalar la aplicación nativamente en iOS y Android, operando en pantalla completa.
- **Persistencia de Datos (`localStorage`):** Almacenamiento local de configuraciones, estado de ruta y claves API, garantizando la recuperación de datos ante cierres inesperados.

---

## 🛠️ Stack Tecnológico

- **Frontend:** HTML5, CSS3 (Diseño responsivo y modo oscuro), JavaScript (Vanilla ES6+).
- **Mapas y Renderizado:** Leaflet.js, OpenStreetMap.
- **APIs de Geocodificación y Tráfico:** Nominatim API, TomTom Routing API.
- **Inteligencia Artificial:** Google Gemini 2.5 Flash API (Procesamiento Multimodal).

---

## 📂 Estructura del Repositorio

```text
ahhheleeera-shstmr-pro/
├── index.html     # Estructura de la SPA, contenedores y UI.
├── styles.css     # Estilos modulares, diseño de tarjetas y animaciones.
├── app.js         # Lógica central: IA, TomTom API, Leaflet y Callejero.
├── manifest.json  # Configuración del Web App Manifest para PWA.
├── sw.js          # Service Worker para gestión de caché y funcionamiento offline.
└── README.md      # Documentación técnica del proyecto.
