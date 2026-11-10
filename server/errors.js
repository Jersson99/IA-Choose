// Error con código HTTP; el manejador central lo convierte en respuesta JSON
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
