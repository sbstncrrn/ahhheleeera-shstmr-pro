// Arreglo global de paradas de la ruta
let optimizedPath = [];
let map = null;
let markersGroup = null;

// Claves para el almacenamiento local (localStorage)
const STORAGE_KEY_PATH = "ahhheleeera_path";
const STORAGE_KEY_INPUT = "ahhheleeera_input";

// Al cargar la página, restaurar datos previos
document.addEventListener("DOMContentLoaded", () => {
    restaurarEstadoGuardado();
});

// Inicializar el mapa interactivo Leaflet
function initMap(lat, lon) {
    if (!map) {
        map = L.map('map').setView([lat, lon], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);
        markersGroup = L.layerGroup().addTo(map);
    } else {
        map.setView([lat, lon], 13);
    }
}

// Fórmula de Haversine para calcular la distancia en kilómetros
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// Consulta asíncrona de geocodificación
async function geocodificarDireccion(direccion) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return { 
                address: direccion, 
                lat: parseFloat(data[0].lat), 
                lon: parseFloat(data[0].lon),
                delivered: false // Propiedad que indica si el paquete fue entregado
            };
        }
    } catch (error) {
        console.error("Error al geocodificar:", error);
    }
    return null;
}

// Algoritmo de optimización (Vecino más cercano)
function optimizarRuta(puntos, inicio) {
    let noVisitados = [...puntos];
    let ruta = [];
    let puntoActual = inicio;

    while (noVisitados.length > 0) {
        let indiceMasCercano = 0;
        let distanciaMinima = Infinity;

        for (let i = 0; i < noVisitados.length; i++) {
            let d = calcularDistancia(puntoActual.lat, puntoActual.lon, noVisitados[i].lat, noVisitados[i].lon);
            if (d < distanciaMinima) {
                distanciaMinima = d;
                indiceMasCercano = i;
            }
        }

        puntoActual = noVisitados[indiceMasCercano];
        ruta.push(puntoActual);
        noVisitados.splice(indiceMasCercano, 1);
    }
    return ruta;
}

// Procesa el texto de entrada y optimiza la ruta
async function procesarYOptimizar() {
    const statusDiv = document.getElementById('status');
    const rawText = document.getElementById('addressInput').value.trim();
    if (!rawText) {
        alert("Por favor ingresa al menos una dirección.");
        return;
    }

    localStorage.setItem(STORAGE_KEY_INPUT, rawText);

    const lineas = rawText.split('\n').filter(line => line.trim() !== '');
    statusDiv.innerText = `Obteniendo ubicación GPS...`;

    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const origen = { address: "Origen Actual", lat: position.coords.latitude, lon: position.coords.longitude };
        let puntosValidos = [];

        for (let i = 0; i < lineas.length; i++) {
            statusDiv.innerText = `Buscando coordenadas (${i + 1}/${lineas.length})...`;
            let res = await geocodificarDireccion(lineas[i]);
            if (res) puntosValidos.push(res);
            await new Promise(r => setTimeout(r, 400));
        }

        if (puntosValidos.length === 0) {
            statusDiv.innerText = "No se encontraron las direcciones ingresadas.";
            return;
        }

        statusDiv.innerText = "Calculando orden óptimo...";
        optimizedPath = optimizarRuta(puntosValidos, origen);

        guardarEnStorage();

        initMap(origen.lat, origen.lon);
        renderizarRuta();
        statusDiv.innerText = "¡Ruta calculada con éxito!";
    }, (error) => {
        console.error("Error GPS:", error);
        alert("Error al obtener la ubicación GPS.");
        statusDiv.innerText = "Error de acceso al GPS.";
    }, geoOptions);
}

// Renderizar la lista de entregas y marcadores del mapa
function renderizarRuta() {
    document.getElementById('routeContainer').style.display = 'block';
    const stopsList = document.getElementById('stopsList');
    const nextAction = document.getElementById('nextStopAction');
    stopsList.innerHTML = '';
    
    if (markersGroup) {
        markersGroup.clearLayers();
    }

    let polylinePoints = [];

    // Buscar la primera parada que aún NO esté entregada para la acción prioritaria
    const siguientePendienteIndex = optimizedPath.findIndex(item => !item.delivered);

    if (siguientePendienteIndex !== -1) {
        const siguiente = optimizedPath[siguientePendienteIndex];
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${siguiente.lat},${siguiente.lon}&travelmode=driving`;
        
        nextAction.innerHTML = `
            <p><strong>🔥 Siguiente entrega pendiente (#${siguientePendienteIndex + 1}):</strong><br>${siguiente.address}</p>
            <a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-success">
                🚀 Navegar en Maps / Android Auto
            </a>
        `;
    } else if (optimizedPath.length > 0) {
        nextAction.innerHTML = `<p>🎉 ¡Todos los paquetes de la lista han sido repartidos!</p>`;
    } else {
        nextAction.innerHTML = `<p>No hay paradas en la lista.</p>`;
    }

    // Dibujar cada tarjeta y marcador
    optimizedPath.forEach((item, index) => {
        polylinePoints.push([item.lat, item.lon]);

        // Crear marcador en el mapa
        const classIcon = item.delivered ? 'number-icon number-icon-delivered' : 'number-icon';
        const customIcon = L.divIcon({ className: classIcon, html: `${index + 1}`, iconSize: [25, 25] });

        if (map && markersGroup) {
            const estadoTexto = item.delivered ? '✅ Repartido' : '📦 Pendiente';
            L.marker([item.lat, item.lon], { icon: customIcon })
                .addTo(markersGroup)
                .bindPopup(`<b>Parada #${index + 1} (${estadoTexto})</b><br>${item.address}`);
        }

        // Crear elemento de tarjeta
        const card = document.createElement('div');
        card.className = `stop-card ${item.delivered ? 'delivered' : ''}`;
        card.draggable = true; // Habilita Drag and Drop
        card.dataset.index = index;

        const mapUrlIndividual = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}&travelmode=driving`;

        card.innerHTML = `
            <div class="stop-header">
                <span class="badge ${item.delivered ? 'badge-delivered' : ''}">
                    Parada #${index + 1} ${item.delivered ? '- ENTREGADO' : ''}
                </span>
                <div class="stop-actions">
                    <button class="reorder-btn" onclick="moverParada(${index}, -1)" ${index === 0 ? 'disabled' : ''}>🔼</button>
                    <button class="reorder-btn" onclick="moverParada(${index}, 1)" ${index === optimizedPath.length - 1 ? 'disabled' : ''}>🔽</button>
                </div>
            </div>
            
            <div class="stop-address"><strong>${item.address}</strong></div>
            
            <a href="${mapUrlIndividual}" target="_blank" rel="noopener" class="btn btn-secondary btn-small">
                🧭 Navegar a este punto
            </a>

            <label class="checkbox-container">
                <input type="checkbox" ${item.delivered ? 'checked' : ''} onchange="toggleRepartido(${index})">
                <span>Marcar como Repartido / Entregado</span>
            </label>
        `;

        // Eventos para Drag and Drop
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        stopsList.appendChild(card);
    });

    // Trazar línea de ruta en el mapa
    if (map && markersGroup && polylinePoints.length > 0) {
        const polyline = L.polyline(polylinePoints, { color: '#ff5722', weight: 4 }).addTo(markersGroup);
        map.fitBounds(polyline.getBounds());
    }
}

// Función para cambiar el estado de "Repartido" (Check)
function toggleRepartido(index) {
    optimizedPath[index].delivered = !optimizedPath[index].delivered;
    guardarEnStorage();
    renderizarRuta();
}

// Mover posición arriba (-1) o abajo (+1) con botones
function moverParada(index, direccion) {
    const nuevoIndice = index + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= optimizedPath.length) return;

    // Intercambiar elementos
    const temp = optimizedPath[index];
    optimizedPath[index] = optimizedPath[nuevoIndice];
    optimizedPath[nuevoIndice] = temp;

    guardarEnStorage();
    renderizarRuta();
}

// --- Eventos de Drag & Drop ---
let dragSrcIndex = null;

function handleDragStart(e) {
    dragSrcIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const targetIndex = parseInt(this.dataset.index);

    if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
        const movedItem = optimizedPath.splice(dragSrcIndex, 1)[0];
        optimizedPath.splice(targetIndex, 0, movedItem);
        guardarEnStorage();
        renderizarRuta();
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('dragging');
}

// --- Guardado y Restauración ---
function guardarEnStorage() {
    localStorage.setItem(STORAGE_KEY_PATH, JSON.stringify(optimizedPath));
}

function restaurarEstadoGuardado() {
    const savedInput = localStorage.getItem(STORAGE_KEY_INPUT);
    const savedPath = localStorage.getItem(STORAGE_KEY_PATH);

    if (savedInput) {
        document.getElementById('addressInput').value = savedInput;
    }

    if (savedPath) {
        try {
            optimizedPath = JSON.parse(savedPath);
            if (optimizedPath.length > 0) {
                initMap(optimizedPath[0].lat, optimizedPath[0].lon);
                renderizarRuta();
                document.getElementById('status').innerText = "Ruta anterior restaurada automáticamente.";
            }
        } catch (e) {
            console.error("Error al restaurar datos:", e);
        }
    }
}

function limpiarRutaGuardada() {
    localStorage.removeItem(STORAGE_KEY_PATH);
    localStorage.removeItem(STORAGE_KEY_INPUT);
    optimizedPath = [];
    document.getElementById('addressInput').value = '';
    document.getElementById('routeContainer').style.display = 'none';
    document.getElementById('status').innerText = "Ruta borrada con éxito.";
}
