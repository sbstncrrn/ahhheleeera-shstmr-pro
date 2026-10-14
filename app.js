let optimizedPath = [];
let map = null;
let markersGroup = null;

// Reemplaza con tus claves reales
const TOMTOM_API_KEY = "Bvdb3uwEWlC1fwP" + "KzATxGORsac2mn5g6"; 
const GEMINI_API_KEY = "AQ.Ab8RN6LLZ84" + "-RHhXBItfw5nfXepjm7HFv4FSHek-H63rSvdhCA";
const STORAGE_KEY_PATH = "ahhheleeera_path";
const STORAGE_KEY_INPUT = "ahhheleeera_input";
const STORAGE_KEY_GPS = "ahhheleeera_gps_pref";
const STORAGE_KEY_PHONES = "ahhheleeera_phones";
const STORAGE_KEY_MODE = "ahhheleeera_vehicle_mode";

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

document.addEventListener("DOMContentLoaded", () => {
    restaurarEstadoGuardado();
});

// ==========================================
// ESCÁNER IA GEMINI (DIRECCIÓN + TELÉFONO)
// ==========================================
async function escanearEtiquetaConIA(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const statusDiv = document.getElementById('status');
    statusDiv.innerText = "🔍 Analizando etiqueta con IA...";

    const lector = new FileReader();
    lector.onload = async function(e) {
        const base64Data = e.target.result.split(',')[1];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `Analiza la imagen de esta etiqueta de envío en Chile. Extrae la siguiente información y responde ÚNICAMENTE en formato JSON válido sin markdown:
{
  "direccion": "Dirección completa",
  "telefono": "Número celular chileno en formato 569XXXXXXXX (o null si no hay)"
}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: archivo.type, data: base64Data } }] }] })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                let rawText = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                const resultado = JSON.parse(rawText);
                
                if (resultado.direccion) {
                    const textarea = document.getElementById('addressInput');
                    textarea.value += (textarea.value.trim() ? '\n' : '') + resultado.direccion;
                    localStorage.setItem(STORAGE_KEY_INPUT, textarea.value);
                    
                    if (resultado.telefono) guardarTelefono(resultado.direccion, resultado.telefono);
                    statusDiv.innerText = `✅ Agregado: ${resultado.direccion}`;
                }
            } else {
                statusDiv.innerText = "⚠️ No se pudo leer la etiqueta.";
            }
        } catch (error) {
            statusDiv.innerText = "❌ Error con la IA.";
        }
        event.target.value = '';
    };
    lector.readAsDataURL(archivo);
}

// ==========================================
// GESTIÓN DE TELÉFONOS
// ==========================================
function guardarTelefono(direccion, telefono) {
    let mapa = JSON.parse(localStorage.getItem(STORAGE_KEY_PHONES) || "{}");
    mapa[direccion] = telefono;
    localStorage.setItem(STORAGE_KEY_PHONES, JSON.stringify(mapa));
}

function obtenerTelefono(direccion) {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_PHONES) || "{}")[direccion] || null;
}

// ==========================================
// MOTOR DE OPTIMIZACIÓN TOMTOM (AUTO / BICI)
// ==========================================
function actualizarModoViaje() {
    const modo = document.querySelector('input[name="vehicleMode"]:checked').value;
    localStorage.setItem(STORAGE_KEY_MODE, modo);
}

async function obtenerMatrizTomTom(puntos) {
    const modo = localStorage.getItem(STORAGE_KEY_MODE) || "car";
    // Si es bicicleta, TomTom adapta la ruta usando carriles bici y calles permitidas
    const url = `https://api.tomtom.com/routing/1/matrix/sync/json?key=${TOMTOM_API_KEY}&travelMode=${modo}`;
    const payload = {
        origins: puntos.map(p => ({ point: { latitude: p.lat, longitude: p.lon } })),
        destinations: puntos.map(p => ({ point: { latitude: p.lat, longitude: p.lon } }))
    };

    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) return null;
        const data = await response.json();
        const matrix = [];
        data.matrix.forEach((row, rIdx) => {
            matrix[rIdx] = [];
            row.forEach((cell, cIdx) => matrix[rIdx][cIdx] = cell.response.routeSummary.travelTimeInSeconds);
        });
        return matrix;
    } catch (e) { return null; }
}

async function optimizarRuta(puntosValidos, origen) {
    const todos = [origen, ...puntosValidos];
    if (TOMTOM_API_KEY !== "TU_CLAVE_TOMTOM_AQUI") {
        const matriz = await obtenerMatrizTomTom(todos);
        if (matriz) {
            let pendientes = puntosValidos.map((_, i) => i + 1);
            let ruta = [];
            let actual = 0;
            while (pendientes.length > 0) {
                let proximo = pendientes[0];
                let minTiempo = Infinity;
                for (let i = 0; i < pendientes.length; i++) {
                    if (matriz[actual][pendientes[i]] < minTiempo) {
                        minTiempo = matriz[actual][pendientes[i]];
                        proximo = pendientes[i];
                    }
                }
                ruta.push(todos[proximo]);
                pendientes = pendientes.filter(idx => idx !== proximo);
                actual = proximo;
            }
            return ruta;
        }
    }
    return puntosValidos; // Fallback simplificado
}

// ==========================================
// FLUJO PRINCIPAL Y MAPA
// ==========================================
async function procesarYOptimizar() {
    const statusDiv = document.getElementById('status');
    const rawText = document.getElementById('addressInput').value.trim();
    if (!rawText) return alert("Ingresa direcciones.");

    localStorage.setItem(STORAGE_KEY_INPUT, rawText);
    const lineas = rawText.split('\n').filter(line => line.trim() !== '');
    statusDiv.innerText = "📍 Buscando coordenadas...";

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const origen = { address: "Origen", lat: pos.coords.latitude, lon: pos.coords.longitude };
        let validos = [];

        for (let dir of lineas) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}&countrycodes=cl&limit=1`);
            const data = await res.json();
            if (data.length > 0) validos.push({ address: dir, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), delivered: false });
            await new Promise(r => setTimeout(r, 400));
        }

        statusDiv.innerText = "🚦 Calculando la mejor ruta...";
        optimizedPath = await optimizarRuta(validos, origen);
        
        guardarEnStorage();
        initMap(origen.lat, origen.lon);
        renderizarRuta();
        statusDiv.innerText = "¡Ruta lista!";
    }, () => alert("Activa el GPS."), { enableHighAccuracy: true });
}

function initMap(lat, lon) {
    if (!map) {
        map = L.map('map').setView([lat, lon], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        markersGroup = L.layerGroup().addTo(map);
    } else { map.setView([lat, lon], 13); }
}

function generarEnlaces(lat, lon, direccion) {
    const modo = localStorage.getItem(STORAGE_KEY_MODE) || "car";
    const googleMode = modo === "bicycle" ? "bicycling" : "driving";
    const telefono = obtenerTelefono(direccion);
    const msg = encodeURIComponent(`¡Hola! Tu paquete va en camino a: ${direccion}.`);
    
    return {
        google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=${googleMode}`,
        waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
        whatsapp: telefono ? `https://api.whatsapp.com/send?phone=${telefono}&text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`,
        telGuardado: !!telefono
    };
}

function renderizarRuta() {
    document.getElementById('routeContainer').style.display = 'block';
    const list = document.getElementById('stopsList');
    const nextAction = document.getElementById('nextStopAction');
    const prefGPS = localStorage.getItem(STORAGE_KEY_GPS) || "google";
    list.innerHTML = '';
    if (markersGroup) markersGroup.clearLayers();

    let puntosLinea = [];
    const sigIndex = optimizedPath.findIndex(i => !i.delivered);

    if (sigIndex !== -1) {
        const sig = optimizedPath[sigIndex];
        const links = generarEnlaces(sig.lat, sig.lon, sig.address);
        const urlNavegador = prefGPS === 'waze' ? links.waze : links.google;
        
        nextAction.innerHTML = `
            <p style="color: var(--text-muted); font-size: 0.85rem; font-weight: bold; margin-bottom: 5px;">SIGUIENTE ENTREGA (#${sigIndex + 1})</p>
            <p style="font-size: 1.1rem; font-weight: bold; margin-bottom: 12px;">${sig.address}</p>
            <a href="${urlNavegador}" target="_blank" class="btn btn-success">🚀 Navegar a Destino</a>
        `;
    } else {
        nextAction.innerHTML = `<p>🎉 ¡Ruta completada!</p>`;
    }

    optimizedPath.forEach((item, idx) => {
        puntosLinea.push([item.lat, item.lon]);
        const links = generarEnlaces(item.lat, item.lon, item.address);
        
        const icon = L.divIcon({ className: item.delivered ? 'number-icon number-icon-delivered' : 'number-icon', html: `${idx + 1}`, iconSize: [25,25] });
        if (markersGroup) L.marker([item.lat, item.lon], { icon }).addTo(markersGroup).bindPopup(`#${idx + 1}: ${item.address}`);

        const card = document.createElement('div');
        card.className = `stop-card ${item.delivered ? 'delivered' : ''}`;
        card.innerHTML = `
            <div class="stop-header">
                <span class="badge ${item.delivered ? 'badge-delivered' : ''}">Parada #${idx + 1}</span>
                <div class="reorder-controls">
                    <button class="reorder-btn" onclick="moverParada(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>🔼</button>
                    <button class="reorder-btn" onclick="moverParada(${idx}, 1)" ${idx === optimizedPath.length - 1 ? 'disabled' : ''}>🔽</button>
                </div>
            </div>
            <div class="stop-address">${item.address}</div>
            <div class="action-row">
                <a href="${links.google}" target="_blank" class="btn btn-secondary btn-small">🗺️ Maps</a>
                <a href="${links.waze}" target="_blank" class="btn btn-secondary btn-small" style="background: var(--waze); color: black;">🚙 Waze</a>
                <a href="${links.whatsapp}" target="_blank" class="btn btn-secondary btn-small btn-whatsapp">💬 ${links.telGuardado ? 'WhatsApp' : 'Avisar'}</a>
            </div>
            <label class="checkbox-container">
                <input type="checkbox" ${item.delivered ? 'checked' : ''} onchange="toggleRepartido(${idx})">
                <span>Marcar como Entregado</span>
            </label>
        `;
        list.appendChild(card);
    });

    if (markersGroup && puntosLinea.length > 0) {
        L.polyline(puntosLinea, { color: '#ff5722', weight: 4 }).addTo(markersGroup);
        map.fitBounds(L.polyline(puntosLinea).getBounds());
    }
}

// Utilidades
function toggleRepartido(idx) { optimizedPath[idx].delivered = !optimizedPath[idx].delivered; guardarEnStorage(); renderizarRuta(); }
function moverParada(idx, dir) { const n = idx + dir; if (n < 0 || n >= optimizedPath.length) return; const t = optimizedPath[idx]; optimizedPath[idx] = optimizedPath[n]; optimizedPath[n] = t; guardarEnStorage(); renderizarRuta(); }
function guardarPreferenciaGPS() { localStorage.setItem(STORAGE_KEY_GPS, document.getElementById('gpsSelect').value); renderizarRuta(); }
function guardarEnStorage() { localStorage.setItem(STORAGE_KEY_PATH, JSON.stringify(optimizedPath)); }
function limpiarRutaGuardada() { localStorage.removeItem(STORAGE_KEY_PATH); localStorage.removeItem(STORAGE_KEY_INPUT); optimizedPath = []; document.getElementById('addressInput').value = ''; document.getElementById('routeContainer').style.display = 'none'; document.getElementById('status').innerText = "Ruta borrada."; }

function restaurarEstadoGuardado() {
    const modo = localStorage.getItem(STORAGE_KEY_MODE);
    if (modo) document.querySelector(`input[value="${modo}"]`).checked = true;
    
    const gps = localStorage.getItem(STORAGE_KEY_GPS);
    if (gps) document.getElementById('gpsSelect').value = gps;

    const input = localStorage.getItem(STORAGE_KEY_INPUT);
    if (input) document.getElementById('addressInput').value = input;

    const path = localStorage.getItem(STORAGE_KEY_PATH);
    if (path) {
        optimizedPath = JSON.parse(path);
        if (optimizedPath.length > 0) {
            initMap(optimizedPath[0].lat, optimizedPath[0].lon);
            renderizarRuta();
        }
    }
}
