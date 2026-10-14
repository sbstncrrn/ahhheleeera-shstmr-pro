let optimizedPath = [];
let map = null;
let markersGroup = null;

const STORAGE_KEY_PATH = "ahhheleeera_path";
const STORAGE_KEY_INPUT = "ahhheleeera_input";

document.addEventListener("DOMContentLoaded", () => {
    restaurarEstadoGuardado();
});

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

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

async function geocodificarDireccion(direccion) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return { address: direccion, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
    } catch (error) {
        console.error("Error de geocodificación:", error);
    }
    return null;
}

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
        alert("Tu navegador no soporta geolocalización GPS.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const origen = { address: "Origen Actual", lat: position.coords.latitude, lon: position.coords.longitude };
        let puntosValidos = [];

        for (let i = 0; i < lineas.length; i++) {
            statusDiv.innerText = `Buscando coordenadas de entrega (${i + 1}/${lineas.length})...`;
            let res = await geocodificarDireccion(lineas[i]);
            if (res) puntosValidos.push(res);
            await new Promise(r => setTimeout(r, 400));
        }

        if (puntosValidos.length === 0) {
            statusDiv.innerText = "No se pudieron encontrar las direcciones ingresadas.";
            return;
        }

        statusDiv.innerText = "Optimizando la secuencia de entregas...";
        optimizedPath = optimizarRuta(puntosValidos, origen);

        localStorage.setItem(STORAGE_KEY_PATH, JSON.stringify(optimizedPath));

        initMap(origen.lat, origen.lon);
        renderizarRuta();
        statusDiv.innerText = "¡Ruta calculada y guardada!";
    }, (error) => {
        console.error("Error GPS:", error);
        alert("Error al obtener la ubicación GPS.");
        statusDiv.innerText = "Error de acceso al GPS.";
    }, geoOptions);
}

function renderizarRuta() {
    document.getElementById('routeContainer').style.display = 'block';
    const stopsList = document.getElementById('stopsList');
    const nextAction = document.getElementById('nextStopAction');
    stopsList.innerHTML = '';
    
    if (markersGroup) {
        markersGroup.clearLayers();
    }

    let polylinePoints = [];

    if (optimizedPath.length > 0) {
        const siguiente = optimizedPath[0];
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${siguiente.lat},${siguiente.lon}&travelmode=driving`;
        
        nextAction.innerHTML = `
            <p><strong>🔥 Siguiente entrega prioritaria:</strong><br>${siguiente.address}</p>
            <a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-success" onclick="completarParada(0)">
                🚀 Navegar en Maps / Android Auto
            </a>
        `;
    } else {
        nextAction.innerHTML = `<p>🎉 ¡Todas las entregas han sido completadas!</p>`;
    }

    optimizedPath.forEach((item, index) => {
        polylinePoints.push([item.lat, item.lon]);
        const customIcon = L.divIcon({ className: 'number-icon', html: `${index + 1}`, iconSize: [25, 25] });

        if (map && markersGroup) {
            L.marker([item.lat, item.lon], { icon: customIcon })
                .addTo(markersGroup)
                .bindPopup(`<b>Parada #${index + 1}</b><br>${item.address}`);
        }

        const mapUrlIndividual = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}&travelmode=driving`;

        const card = document.createElement('div');
        card.className = 'stop-card';
        card.innerHTML = `
            <div><span class="badge">Parada #${index + 1}</span></div>
            <strong>${item.address}</strong><br>
            <a href="${mapUrlIndividual}" target="_blank" rel="noopener" class="btn btn-secondary" onclick="completarParada(${index})">
                Ir a este punto
            </a>
        `;
        stopsList.appendChild(card);
    });

    if (map && markersGroup && polylinePoints.length > 0) {
        const polyline = L.polyline(polylinePoints, { color: '#ff5722', weight: 4 }).addTo(markersGroup);
        map.fitBounds(polyline.getBounds());
    }
}

function completarParada(index) {
    setTimeout(() => {
        optimizedPath.splice(index, 1);
        localStorage.setItem(STORAGE_KEY_PATH, JSON.stringify(optimizedPath));
        renderizarRuta();
    }, 500);
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
