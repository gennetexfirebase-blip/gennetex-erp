/* Shared by the native WebView and the admin iframe. No authentication data enters the map. */
function buildTrackingMapHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <style>html,body,#map{height:100%;margin:0;background:#e8eef3}.employee-pin{background:#075275;color:white;border:2px solid white;border-radius:12px;padding:6px 10px;white-space:nowrap;width:max-content!important;height:auto!important;font:600 12px system-ui;box-shadow:0 3px 12px #0003}.employee-pin.offline{background:#64748b}.employee-pin.weak{background:#a16207}.leaflet-tooltip{font:12px system-ui}#error{position:absolute;top:12px;left:12px;z-index:999;background:white;padding:8px;border-radius:8px}</style></head><body><div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
  function emit(data){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else parent.postMessage({trackingMap:data},'*');}
  if(!window.L){document.body.insertAdjacentHTML('beforeend','<p id="error">Газрын зураг ачаалагдсангүй. Интернет холболтоо шалгана уу.</p>');emit({type:'error'});}else{
  const map=L.map('map').setView([47.9189,106.9184],12);
  const street=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',maxZoom:19}).addTo(map);
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri',maxZoom:19});
  const markers=new Map();let route=L.polyline([],{color:'#0891b2',weight:4}).addTo(map),start=null,sites=L.layerGroup().addTo(map),follow=false,selected=null,autoFit=false,lastFollowTimestamp=null;
  function escape(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function icon(p){return L.divIcon({className:'employee-pin '+(p.status||''),html:escape(p.name||p.employee_id)+'<br>'+escape(p.status==='offline'?p.lastSeen:(p.speed==null?'—':Math.round(p.speed*3.6))+' km/h'),iconAnchor:[25,20]});}
  function animate(marker,p){if(marker.frame)cancelAnimationFrame(marker.frame);const from=marker.getLatLng(),to=L.latLng(p.latitude,p.longitude);if(from.distanceTo(to)>2000||matchMedia('(prefers-reduced-motion: reduce)').matches){marker.setLatLng(to);return;}const began=performance.now();function tick(t){const k=Math.min(1,(t-began)/1000),v=k*(2-k);marker.setLatLng([from.lat+(to.lat-from.lat)*v,from.lng+(to.lng-from.lng)*v]);if(k<1)marker.frame=requestAnimationFrame(tick);}marker.frame=requestAnimationFrame(tick);}
  map.on('dragstart',()=>{follow=false;emit({type:'pan'});});
  window.trackingUpdate=function(data){
    if(data.employees){const ids=new Set();data.employees.forEach(p=>{ids.add(p.employee_id);let m=markers.get(p.employee_id);if(!m){m=L.marker([p.latitude,p.longitude],{icon:icon(p)}).addTo(map);m.on('click',()=>emit({type:'select',id:p.employee_id}));markers.set(p.employee_id,m);}else{const signature=JSON.stringify([p.name,p.status,p.speed,p.status==='offline'?p.lastSeen:null]);if(m.signature!==signature){m.setIcon(icon(p));m.signature=signature;}if(m.timestamp!==p.timestamp)animate(m,p);}m.timestamp=p.timestamp;});markers.forEach((m,id)=>{if(!ids.has(id)){if(m.frame)cancelAnimationFrame(m.frame);map.removeLayer(m);markers.delete(id);}});
      if(!autoFit&&markers.size){map.fitBounds(L.latLngBounds(data.employees.map(p=>[p.latitude,p.longitude])),{padding:[45,45],maxZoom:16});autoFit=true;}
      if(follow&&selected){const p=data.employees.find(p=>p.employee_id===selected);if(p&&lastFollowTimestamp!==p.timestamp){lastFollowTimestamp=p.timestamp;map.panTo([p.latitude,p.longitude],{animate:true,duration:1});}}
    }
    if(data.route){route.setLatLngs(data.route.map(p=>[p.latitude,p.longitude]));if(start)map.removeLayer(start);if(data.route.length)start=L.circleMarker([data.route[0].latitude,data.route[0].longitude],{color:'#16a34a',radius:8,fillOpacity:1}).addTo(map).bindTooltip('Эхэлсэн байршил');}
    if(data.sites){sites.clearLayers();data.sites.forEach(p=>{if(Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)){const label=document.createElement('span');label.textContent=p.name||p.customer||'Үйлчилгээний байршил';L.circleMarker([p.latitude,p.longitude],{color:'#7c3aed',radius:7}).addTo(sites).bindTooltip(label);}});}
    if(data.command==='route'&&route.getLatLngs().length){follow=false;map.fitBounds(route.getBounds(),{padding:[35,35],maxZoom:17});}
    if(data.selected!==undefined)selected=data.selected;
    if(data.follow!==undefined)follow=data.follow;
    if(data.command==='current'&&markers.get(selected))map.setView(markers.get(selected).getLatLng(),16,{animate:true});
    if(data.satellite!==undefined){if(data.satellite){map.removeLayer(street);satellite.addTo(map);}else{map.removeLayer(satellite);street.addTo(map);}}
  };
  window.addEventListener('message',e=>{if(e.source===parent&&e.data&&e.data.trackingUpdate)window.trackingUpdate(e.data.trackingUpdate);});
  emit({type:'ready'});
  }
  </script></body></html>`;
}
if (typeof module !== 'undefined') module.exports = { buildTrackingMapHtml };
if (typeof window !== 'undefined') window.buildTrackingMapHtml = buildTrackingMapHtml;
