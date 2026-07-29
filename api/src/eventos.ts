import { EventEmitter } from "events";

const eventos = new EventEmitter();
eventos.setMaxListeners(100);

export default eventos;
