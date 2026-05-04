import { initializeApp } from "firebase-admin/app";

initializeApp();

export { setUserRole, inviteUser } from "./usuarios";
export {
  onPessoaWrite,
  onParticipacaoWrite,
  onEdicaoWrite,
} from "./auditoria";
export { gerarLinkValidacao, revogarLink, validarLink } from "./links";
export { processarFotoPessoa, cleanupFotosAntigas } from "./fotos";
export { backupSemanal } from "./backup";
