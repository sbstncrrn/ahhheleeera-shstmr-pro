let optimizedPath = [];
let map = null;
let markersGroup = null;
let debounceTimer = null;

const STORAGE_KEY_PATH = "ahhheleeera_path";
const STORAGE_KEY_INPUT = "ahhheleeera_input";
const STORAGE_KEY_GPS = "ahhheleeera_gps_pref";
const STORAGE_KEY_TOMTOM_KEY = "ahhheleeera_tomtom_key";

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker activo:', reg.scope))
            .catch(err => console.error('Error Service Worker:', err));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    restaurarEstadoGuardado();
});

// Configuración API Key de TomTom
function guardarApiKeyTomTom() {
    const keyInput = document.getElementById('tomtomKeyInput').value.trim();
    if (keyInput) {
        localStorage.setItem(STORAGE_KEY_TOMTOM_KEY, keyInput);
        document.getElementById('status').innerText = "🔑 API Key de TomTom guardada correctamente.";
    } else {
        localStorage.removeItem(STORAGE_KEY_TOMTOM_KEY);
        document.getElementById('status').innerText = "⚠️ API Key eliminada.";
    }
}

// Consultar matriz de tráfico en tiempo real a TomTom
async function obtenerMatrizTraficoTomTom(puntos, apiKey) {
    const url = `https://api.tomtom.com/routing/1/matrix/sync/json?key=${apiKey}`;
    const bodyPayload = {
        origins: puntos.map(p => ({ point: { latitude: p.lat, longitude: p.lon } })),
        destinations: puntos.map(p => ({ point: { latitude: p.lat, longitude: p.lon } }))
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        
        const matrix = [];
        data.matrix.forEach((row, rowIndex) => {
            matrix[rowIndex] = [];
            row.forEach((cell, colIndex) => {
                matrix[rowIndex][colIndex] = cell.response.routeSummary.travelTimeInSeconds;
            });
        });
        return matrix;
    } catch (error) {
        console.error("Error al consultar TomTom Traffic:", error);
        return null;
    }
}

// Algoritmo de optimización por tráfico real
async function optimizarRutaConTraficoReal(puntosValidos, origen) {
    const apiKey = localStorage.getItem(STORAGE_KEY_TOMTOM_KEY);
    const todosLosPuntos = [origen, ...puntosValidos];

    if (apiKey) {
        document.getElementById('status').innerText = "🚦 Consultando tráfico en tiempo real con TomTom...";
        const matrizTiempos = await obtenerMatrizTraficoTomTom(todosLosPuntos, apiKey);

        if (matrizTiempos) {
            let noVisitadosIndices = puntosValidos.map((_, index) => index + 1);
            let rutaOptimizada = [];
            let indiceActual = 0;

            while (noVisitadosIndices.length > 0) {
                let proximoIndice = noVisitadosIndices[0];
                let tiempoMinimo = Infinity;

                for (let i = 0; i < noVisitadosIndices.length; i++) {
                    let candidatoIndice = noVisitadosIndices[i];
                    let tiempoConduccion = matrizTiempos[indiceActual][candidatoIndice];

                    if (tiempoConduccion < tiempoMinimo) {
                        tiempoMinimo = tiempoConduccion;
                        proximoIndice = candidatoIndice;
                    }
                }

                rutaOptimizada.push(todosLosPuntos[proximoIndice]);
                noVisitadosIndices = noVisitadosIndices.filter(idx => idx !== proximoIndice);
                indiceActual = proximoIndice;
            }
            return rutaOptimizada;
        }
    }

    return optimizarRutaHaversine(puntosValidos, origen);
}

// Algoritmo Haversine de respaldo (Fallback)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function optimizarRutaHaversine(puntos, inicio) {
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

// Callejero / Autocompletado
function onDireccionInput() {
    clearTimeout(debounceTimer);
    const query = document.getElementById('autocompleteInput').value.trim();
    const suggestionsBox = document.getElementById('suggestionsBox');

    if (query.length < 3) {
        suggestionsBox.style.display = 'none';
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cl&limit=5`);
            const data = await res.json();
            
            suggestionsBox.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerText = item.display_name;
                    div.onclick = () => seleccionarSugerencia(item.display_name);
                    suggestionsBox.appendChild(div);
                });
                suggestionsBox.style.display = 'block';
            } else {
                suggestionsBox.style.display = 'none';
            }
        } catch (e) {
            console.error("Error autocompletado:", e);
        }
    }, 400);
}

function seleccionarSugerencia(direccionTexto) {
    const textarea = document.getElementById('addressInput');
    if (textarea.value.trim() === '') {
        textarea.value = direccionTexto;
    } else {
        textarea.value += '\n' + direccionTexto;
    }
    
    document.getElementById('autocompleteInput').value = '';
    document.getElementById('suggestionsBox').style.display = 'none';
    localStorage.setItem(STORAGE_KEY_INPUT, textarea.value);
}

// Lógica del Mapa
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

async function geocodificarDireccion(direccion) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return { 
                address: direccion, 
                lat: parseFloat(data[0].lat), 
                lon: parseFloat(data[0].lon),
                delivered: false 
            };
        }
    } catch (error) {
        console.error("Error geocodificando:", error);
    }
    return null;
}

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

        optimizedPath = await optimizarRutaConTraficoReal(puntosValidos, origen);

        guardarEnStorage();
        initMap(origen.lat, origen.lon);
        renderizarRuta();
        statusDiv.innerText = "¡Ruta calculada con éxito considerando el tráfico!";
    }, (error) => {
        console.error("Error GPS:", error);
        alert("Error al obtener la ubicación GPS.");
        statusDiv.innerText = "Error de acceso al GPS.";
    }, geoOptions);
}

function obtenerUrlNavegacion(lat, lon) {
    const gpsPref = localStorage.getItem(STORAGE_KEY_GPS) || "google";
    if (gpsPref === "waze") {
        return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

function renderizarRuta() {
    document.getElementById('routeContainer').style.display = 'block';
    const stopsList = document.getElementById('stopsList');
    const nextAction = document.getElementById('nextStopAction');
    const gpsPref = localStorage.getItem(STORAGE_KEY_GPS) || "google";
    
    stopsList.innerHTML = '';
    if (markersGroup) markersGroup.clearLayers();

    let polylinePoints = [];
    const siguientePendienteIndex = optimizedPath.findIndex(item => !item.delivered);

    if (siguientePendienteIndex !== -1) {
        const siguiente = optimizedPath[siguientePendienteIndex];
        const mapUrl = obtenerUrlNavegacion(siguiente.lat, siguiente.lon);
        const btnClass = gpsPref === 'waze' ? 'btn btn-waze' : 'btn btn-success';
        const btnTexto = gpsPref === 'waze' ? '🚙 Navegar con Waze' : '🚀 Navegar con Google Maps / Android Auto';
        
        nextAction.innerHTML = `
            <p><strong>🔥 Siguiente entrega pendiente (#${siguientePendienteIndex + 1}):</strong><br>${siguiente.address}</p>
            <a href="${mapUrl}" target="_blank" rel="noopener" class="${btnClass}">
                ${btnTexto}
            </a>
        `;
    } else if (optimizedPath.length > 0) {
        nextAction.innerHTML = `<p>🎉 ¡Todos los paquetes han sido repartidos!</p>`;
    } else {
        nextAction.innerHTML = `<p>No hay paradas en la lista.</p>`;
    }

    optimizedPath.forEach((item, index) => {
        polylinePoints.push([item.lat, item.lon]);

        const classIcon = item.delivered ? 'number-icon number-icon-delivered' : 'number-icon';
        const customIcon = L.divIcon({ className: classIcon, html: `${index + 1}`, iconSize: [25, 25] });

        if (map && markersGroup) {
            const estadoTexto = item.delivered ? '✅ Repartido' : '📦 Pendiente';
            L.marker([item.lat, item.lon], { icon: customIcon })
                .addTo(markersGroup)
                .bindPopup(`<b>Parada #${index + 1} (${estadoTexto})</b><br>${item.address}`);
        }

        const mapUrlGoogle = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}&travelmode=driving`;
        const mapUrlWaze = `https://waze.com/ul?ll=${item.lat},${item.lon}&navigate=yes`;

        const card = document.createElement('div');
        card.className = `stop-card ${item.delivered ? 'delivered' : ''}`;

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
            
            <div style="margin-top: 5px;">
                <a href="${mapUrlGoogle}" target="_blank" rel="noopener" class="btn btn-secondary btn-small">
                    🗺️ Google Maps
                </a>
                <a href="${mapUrlWaze}" target="_blank" rel="noopener" class="btn btn-secondary btn-small" style="background: #0099ff;">
                    🚙 Waze
                </a>
            </div>

            <label class="checkbox-container">
                <input type="checkbox" ${item.delivered ? 'checked' : ''} onchange="toggleRepartido(${index})">
                <span>Marcar como Repartido / Entregado</span>
            </label>
        `;

        stopsList.appendChild(card);
    });

    if (map && markersGroup && polylinePoints.length > 0) {
        const polyline = L.polyline(polylinePoints, { color: '#ff5722', weight: 4 }).addTo(markersGroup);
        map.fitBounds(polyline.getBounds());
    }
}

function toggleRepartido(index) {
    optimizedPath[index].delivered = !optimizedPath[index].delivered;
    guardarEnStorage();
    renderizarRuta();
}

function moverParada(index, direccion) {
    const nuevoIndice = index + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= optimizedPath.length) return;

    const temp = optimizedPath[index];
    optimizedPath[index] = optimizedPath[nuevoIndice];
    optimizedPath[nuevoIndice] = temp;

    guardarEnStorage();
    renderizarRuta();
}

function guardarPreferenciaGPS() {
    const val = document.getElementById('gpsSelect').value;
    localStorage.setItem(STORAGE_KEY_GPS, val);
    renderizarRuta();
}

function guardarEnStorage() {
    localStorage.setItem(STORAGE_KEY_PATH, JSON.stringify(optimizedPath));
}

function restaurarEstadoGuardado() {
    const savedInput = localStorage.getItem(STORAGE_KEY_INPUT);
    const savedPath = localStorage.getItem(STORAGE_KEY_PATH);
    const savedGps = localStorage.getItem(STORAGE_KEY_GPS);
    const savedTomTomKey = localStorage.getItem(STORAGE_KEY_TOMTOM_KEY);

    if (savedTomTomKey) {
        const keyElem = document.getElementById('tomtomKeyInput');
        if (keyElem) keyElem.value = savedTomTomKey;
    }

    if (savedGps) {
        const gpsElem = document.getElementById('gpsSelect');
        if (gpsElem) gpsElem.value = savedGps;
    }

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
            console.error("Error leyendo datos guardados:", e);
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
