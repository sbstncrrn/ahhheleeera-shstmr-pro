let optimizedPath = [];
let map = null;
let markersGroup = null;
let debounceTimer = null;

// Reemplaza con tus claves reales partidas con el signo +
const TOMTOM_API_KEY = "Bvdb3uwEWlC1fwP" + "KzATxGORsac2mn5g6" ; 
const GEMINI_API_KEY = "AQ.Ab8RN6LLZ84" + "-RHhXBItfw5nfXepjm7HFv4FSHek-H63rSvdhCA" ; 

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
// MODO VIAJE Y CAMBIO DE LOGO SVG
// ==========================================
function actualizarModoViaje() {
    const modo = document.querySelector('input[name="vehicleMode"]:checked').value;
    localStorage.setItem(STORAGE_KEY_MODE, modo);
    
    // Cambia el logo en el Header
    if (modo === "bicycle") {
        document.getElementById('logo-car').style.display = 'none';
        document.getElementById('logo-bike').style.display = 'block';
    } else {
        document.getElementById('logo-car').style.display = 'block';
        document.getElementById('logo-bike').style.display = 'none';
    }
}

// ==========================================
// CALLEJERO / AUTOCOMPLETADO INTELIGENTE (Solo RM)
// ==========================================
function onDireccionInput() {
    clearTimeout(debounceTimer);
    const inputElement = document.getElementById('autocompleteInput');
    const query = inputElement.value.trim();
    const suggestionsBox = document.getElementById('suggestionsBox');

    if (query.length < 3) {
        suggestionsBox.style.display = 'none';
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            // Restringimos la búsqueda con una "caja de coordenadas" (Viewbox) estricta sobre la RM
            const q = encodeURIComponent(query + ", Región Metropolitana, Chile");
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=cl&viewbox=-71.5,-33.0,-70.0,-34.0&bounded=1&limit=5`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            suggestionsBox.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    
                    let textoLimpio = item.display_name.replace(", Región Metropolitana de Santiago", "").replace(", Chile", "");
                    
                    div.innerText = textoLimpio;
                    div.onclick = () => seleccionarSugerencia(textoLimpio, query);
                    suggestionsBox.appendChild(div);
                });
                suggestionsBox.style.display = 'block';
            } else {
                suggestionsBox.style.display = 'none';
            }
        } catch (e) {
            console.error("Error en radar de calles:", e);
        }
    }, 400);
}

function seleccionarSugerencia(direccionSugerida, textoOriginal) {
    // Extraemos cualquier número que el usuario haya escrito originalmente
    const numeroExtraido = textoOriginal.match(/\d+/);
    let direccionFinal = direccionSugerida;

    // Si el usuario escribió un número, pero la sugerencia de la API no lo trae, se lo inyectamos a la fuerza
    if (numeroExtraido && !direccionSugerida.includes(numeroExtraido[0])) {
        let partes = direccionSugerida.split(',');
        partes[0] = `${partes[0]} ${numeroExtraido[0]}`; // Lo pegamos justo después del nombre de la calle
        direccionFinal = partes.join(',');
    }

    const textarea = document.getElementById('addressInput');
    textarea.value += (textarea.value.trim() === '' ? '' : '\n') + direccionFinal;
    
    document.getElementById('autocompleteInput').value = '';
    document.getElementById('suggestionsBox').style.display = 'none';
    localStorage.setItem(STORAGE_KEY_INPUT, textarea.value);
}

// ==========================================
// ESCÁNER IA GEMINI (DIRECCIÓN + TELÉFONO)
// ==========================================
async function escanearEtiquetaConIA(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const statusDiv = document.getElementById('status');
    statusDiv.innerText = "🔍 HACKEANDO ETIQUETA CON IA...";

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
                    statusDiv.innerText = `✅ OBJETIVO AGREGADO: ${resultado.direccion}`;
                }
            } else {
                statusDiv.innerText = "⚠️ OJO BIÓNICO FALLÓ. NO SE LEE LA ETIQUETA.";
            }
        } catch (error) {
            statusDiv.innerText = "❌ ERROR DE CONEXIÓN CON LA IA.";
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
async function obtenerMatrizTomTom(puntos) {
    const modo = localStorage.getItem(STORAGE_KEY_MODE) || "car";
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
    if (!TOMTOM_API_KEY.includes("PEGA_AQUI")) {
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
    return puntosValidos; 
}

// ==========================================
// FLUJO PRINCIPAL Y MAPA
// ==========================================
async function procesarYOptimizar() {
    const statusDiv = document.getElementById('status');
    const rawText = document.getElementById('addressInput').value.trim();
    if (!rawText) return alert("¡SIN OBJETIVOS! Pega las direcciones primero.");

    localStorage.setItem(STORAGE_KEY_INPUT, rawText);
    const lineas = rawText.split('\n').filter(line => line.trim() !== '');
    statusDiv.innerText = "📍 RASTREANDO COORDENADAS...";

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const origen = { address: "Origen", lat: pos.coords.latitude, lon: pos.coords.longitude };
        let validos = [];

        for (let dir of lineas) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}&countrycodes=cl&limit=1`);
            const data = await res.json();
            if (data.length > 0) validos.push({ address: dir, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), delivered: false });
            await new Promise(r => setTimeout(r, 400));
        }

        statusDiv.innerText = "🚦 DESTRUYENDO RUTAS INÚTILES...";
        optimizedPath = await optimizarRuta(validos, origen);
        
        guardarEnStorage();
        initMap(origen.lat, origen.lon);
        renderizarRuta();
        statusDiv.innerText = "⚡ ¡RUTA LISTA PARA LA ACCIÓN!";
    }, () => alert("¡ACTIVA EL GPS!"), { enableHighAccuracy: true });
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
    const msg = encodeURIComponent(`¡Qué tal! Tu encargo va en camino a: ${direccion}. Sal a recibirlo pronto.`);
    
    // El parámetro &navigate=yes&_t=${Date.now()} fuerza a Waze a sobreescribir rutas anteriores
    return {
        google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=${googleMode}`,
        waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes&_t=${Date.now()}`,
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
            <p style="color: var(--danger); font-size: 0.9rem; font-weight: 900; margin-bottom: 5px; font-family: monospace;">[ OBJETIVO INMEDIATO: #${sigIndex + 1} ]</p>
            <p style="font-size: 1.2rem; font-weight: 900; margin-bottom: 15px; text-transform: uppercase;">${sig.address}</p>
            <a href="${urlNavegador}" target="_blank" class="btn btn-primary" style="box-shadow: 4px 4px 0px var(--danger);">🚀 NAVEGAR Y DESTRUIR MISION</a>
        `;
    } else {
        nextAction.innerHTML = `<p style="font-family: monospace; font-weight: bold; color: var(--primary);">🎉 ¡TODO ENTREGADO, MISIÓN CUMPLIDA!</p>`;
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
                <span class="badge ${item.delivered ? 'badge-delivered' : ''}">OBJETIVO #${idx + 1}</span>
                <div class="reorder-controls">
                    <button class="reorder-btn" onclick="moverParada(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>🔼</button>
                    <button class="reorder-btn" onclick="moverParada(${idx}, 1)" ${idx === optimizedPath.length - 1 ? 'disabled' : ''}>🔽</button>
                </div>
            </div>
            <div class="stop-address">${item.address}</div>
            <div class="action-row">
                <a href="${links.google}" target="_blank" class="btn btn-secondary btn-small">🗺️ MAPS</a>
                <a href="${links.waze}" target="_blank" class="btn btn-secondary btn-small" style="background: var(--waze); color: black;">🚙 WAZE</a>
                <a href="${links.whatsapp}" target="_blank" class="btn btn-secondary btn-small btn-whatsapp">💬 ${links.telGuardado ? 'WHATSAPP' : 'AVISAR'}</a>
            </div>
            <label class="checkbox-container">
                <input type="checkbox" ${item.delivered ? 'checked' : ''} onchange="toggleRepartido(${idx})">
                <span>[X] MARCAR COMO LIQUIDADO</span>
            </label>
        `;
        list.appendChild(card);
    });

    if (markersGroup && puntosLinea.length > 0) {
        L.polyline(puntosLinea, { color: '#ccff00', weight: 5 }).addTo(markersGroup);
        map.fitBounds(L.polyline(puntosLinea).getBounds());
    }
}

// Utilidades
function toggleRepartido(idx) { optimizedPath[idx].delivered = !optimizedPath[idx].delivered; guardarEnStorage(); renderizarRuta(); }
function moverParada(idx, dir) { const n = idx + dir; if (n < 0 || n >= optimizedPath.length) return; const t = optimizedPath[idx]; optimizedPath[idx] = optimizedPath[n]; optimizedPath[n] = t; guardarEnStorage(); renderizarRuta(); }
function guardarPreferenciaGPS() { localStorage.setItem(STORAGE_KEY_GPS, document.getElementById('gpsSelect').value); renderizarRuta(); }
function guardarEnStorage() { localStorage.setItem(STORAGE_KEY_PATH, JSON.stringify(optimizedPath)); }
function limpiarRutaGuardada() { localStorage.removeItem(STORAGE_KEY_PATH); localStorage.removeItem(STORAGE_KEY_INPUT); optimizedPath = []; document.getElementById('addressInput').value = ''; document.getElementById('routeContainer').style.display = 'none'; document.getElementById('status').innerText = "SISTEMA LIMPIO."; }

function restaurarEstadoGuardado() {
    const modo = localStorage.getItem(STORAGE_KEY_MODE) || 'car';
    document.querySelector(`input[value="${modo}"]`).checked = true;
    actualizarModoViaje();
    
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
