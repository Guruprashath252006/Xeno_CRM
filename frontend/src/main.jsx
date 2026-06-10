import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

// Global error overlay so runtime errors are visible instead of a white screen
function showErrorOverlay(message){
	try{
		const root = document.getElementById('root');
		if(root){
			root.innerHTML = '';
			const box = document.createElement('div');
			box.style.position = 'fixed';
			box.style.left = '0'; box.style.top = '0'; box.style.right = '0'; box.style.bottom = '0';
			box.style.background = 'rgba(0,0,0,0.85)';
			box.style.color = 'white';
			box.style.padding = '24px';
			box.style.zIndex = 9999;
			box.style.overflow = 'auto';
			box.innerText = message;
			document.body.appendChild(box);
		}
	}catch(e){ console.error('overlay failed', e) }
}

window.addEventListener('error', (ev)=>{
	showErrorOverlay(ev.error ? ev.error.stack || ev.error.message : String(ev.message));
});
window.addEventListener('unhandledrejection', (ev)=>{
	showErrorOverlay(ev.reason ? (ev.reason.stack || ev.reason) : 'Unhandled rejection');
});

try{
	createRoot(document.getElementById('root')).render(<App />)
}catch(err){
	showErrorOverlay(err.stack || err.message || String(err));
	console.error(err);
}
