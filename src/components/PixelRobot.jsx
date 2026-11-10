/**
 * Robot Pixel-Art SVG con partes separadas para animaciones:
 * - Antena con pulso luminoso y ondas
 * - Cabeza con flotación (breathing) y giro
 * - Ojos reactivos (parpadeo, mirar al formulario/caja de texto, modo privacidad, espiar)
 * - Corazón de píxeles con latido brillante en el pecho
 * - Brazos articulados (saludo, cubrirse, pensar/analizar, celebración)
 */
export default function PixelRobot({ robotMood, onRobotClick, speechText }) {
  return (
    <div
      className={`robot-stage mood-${robotMood}`}
      onClick={onRobotClick}
      role="button"
      tabIndex={0}
      aria-label="Robot asistente de IA CHOOSE. Haz clic para animar."
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRobotClick();
        }
      }}
    >
      {speechText && (
        <div className="robot-speech-bubble" aria-live="polite">
          <span>{speechText}</span>
        </div>
      )}

      <svg
        className="pixel-robot-svg"
        viewBox="0 0 44 54"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {/* Sombra proyectada en el suelo */}
        <g className="robot-ground-shadow">
          <rect x="8" y="51" width="28" height="2" fill="rgba(5, 22, 18, 0.38)" />
          <rect x="11" y="50" width="22" height="1" fill="rgba(5, 22, 18, 0.22)" />
        </g>

        {/* ================= PIERNAS Y PIES (BASE) ================= */}
        <g className="robot-legs">
          {/* Pelvis / Cintura */}
          <rect x="14" y="37" width="16" height="3" fill="#080B09" />
          <rect x="16" y="37" width="12" height="2" fill="#1E2624" />
          <rect x="19" y="38" width="6" height="2" fill="#5CA800" />

          {/* Pierna Izquierda */}
          <rect x="11" y="39" width="9" height="11" fill="#080B09" />
          <rect x="12" y="40" width="7" height="3" fill="#63B800" />
          <rect x="13" y="40" width="5" height="2" fill="#99F018" />
          {/* Rodilla Izquierda */}
          <rect x="12" y="43" width="7" height="2" fill="#1F2725" />
          {/* Bota Izquierda */}
          <rect x="9" y="45" width="12" height="6" fill="#080B09" />
          <rect x="10" y="46" width="3" height="3" fill="#313B38" />
          <rect x="13" y="46" width="7" height="3" fill="#99F018" />
          <rect x="13" y="48" width="7" height="1" fill="#5CA800" />
          <rect x="8" y="49" width="13" height="2" fill="#080B09" />

          {/* Pierna Derecha */}
          <rect x="24" y="39" width="9" height="11" fill="#080B09" />
          <rect x="25" y="40" width="7" height="3" fill="#63B800" />
          <rect x="26" y="40" width="5" height="2" fill="#99F018" />
          {/* Rodilla Derecha */}
          <rect x="25" y="43" width="7" height="2" fill="#1F2725" />
          {/* Bota Derecha */}
          <rect x="23" y="45" width="12" height="6" fill="#080B09" />
          <rect x="31" y="46" width="3" height="3" fill="#313B38" />
          <rect x="24" y="46" width="7" height="3" fill="#99F018" />
          <rect x="24" y="48" width="7" height="1" fill="#5CA800" />
          <rect x="23" y="49" width="13" height="2" fill="#080B09" />
        </g>

        {/* ================= TORSO Y CORAZÓN ================= */}
        <g className="robot-torso-group">
          {/* Cuello */}
          <rect x="16" y="25" width="12" height="2" fill="#080B09" />
          <rect x="18" y="25" width="8" height="2" fill="#2A3431" />

          {/* Contorno Torso */}
          <rect x="12" y="27" width="20" height="10" fill="#080B09" />
          <rect x="13" y="28" width="18" height="8" fill="#63B800" />
          <rect x="14" y="28" width="16" height="6" fill="#99F018" />

          {/* Pantalla del Pecho */}
          <rect x="16" y="29" width="12" height="7" fill="#080B09" />

          {/* Corazón de Píxeles Brillante */}
          <g className="robot-chest-heart">
            <rect x="18" y="30" width="3" height="2" fill="#28FF3E" />
            <rect x="23" y="30" width="3" height="2" fill="#28FF3E" />
            <rect x="17" y="31" width="10" height="2" fill="#28FF3E" />
            <rect x="18" y="33" width="8" height="1" fill="#28FF3E" />
            <rect x="20" y="34" width="4" height="1" fill="#28FF3E" />
            <rect x="21" y="35" width="2" height="1" fill="#28FF3E" />
          </g>

          {/* ================= BRAZO IZQUIERDO ================= */}
          <g className="robot-arm-left">
            {/* Hombro */}
            <rect x="7" y="28" width="5" height="5" fill="#080B09" />
            <rect x="8" y="29" width="3" height="3" fill="#99F018" />
            {/* Antebrazo */}
            <rect x="6" y="33" width="6" height="6" fill="#080B09" />
            <rect x="7" y="34" width="4" height="4" fill="#82DE0C" />
            <rect x="7" y="37" width="4" height="1" fill="#5CA800" />
            {/* Mano / Pinza */}
            <rect x="6" y="39" width="6" height="4" fill="#080B09" />
            <rect x="7" y="39" width="4" height="3" fill="#2F3836" />
            <rect x="8" y="41" width="2" height="2" fill="#080B09" />
          </g>

          {/* ================= BRAZO DERECHO ================= */}
          <g className="robot-arm-right">
            {/* Hombro */}
            <rect x="32" y="28" width="5" height="5" fill="#080B09" />
            <rect x="33" y="29" width="3" height="3" fill="#99F018" />
            {/* Antebrazo */}
            <rect x="32" y="33" width="6" height="6" fill="#080B09" />
            <rect x="33" y="34" width="4" height="4" fill="#82DE0C" />
            <rect x="33" y="37" width="4" height="1" fill="#5CA800" />
            {/* Mano / Pinza */}
            <rect x="32" y="39" width="6" height="4" fill="#080B09" />
            <rect x="33" y="39" width="4" height="3" fill="#2F3836" />
            <rect x="34" y="41" width="2" height="2" fill="#080B09" />
          </g>

          {/* ================= CABEZA Y ANTENA ================= */}
          <g className="robot-head-group">
            {/* Ondas de señal de la antena */}
            <g className="antenna-waves">
              <rect x="17" y="2" width="1" height="3" fill="#28FF3E" opacity="0.7" />
              <rect x="26" y="2" width="1" height="3" fill="#28FF3E" opacity="0.7" />
              <rect x="15" y="1" width="1" height="5" fill="#99F018" opacity="0.45" />
              <rect x="28" y="1" width="1" height="5" fill="#99F018" opacity="0.45" />
            </g>

            {/* Antena Superior */}
            <g className="robot-antenna">
              <rect x="20" y="1" width="4" height="4" fill="#080B09" />
              <rect x="21" y="2" width="2" height="2" fill="#99F018" className="antenna-bulb" />
              <rect x="21" y="5" width="2" height="3" fill="#080B09" />
              <rect x="19" y="8" width="6" height="1" fill="#080B09" />
            </g>

            {/* Oreja Izquierda */}
            <rect x="5" y="14" width="4" height="8" fill="#080B09" />
            <rect x="6" y="15" width="2" height="6" fill="#252E2C" />
            <rect x="6" y="16" width="2" height="4" fill="#99F018" className="ear-light" />

            {/* Oreja Derecha */}
            <rect x="35" y="14" width="4" height="8" fill="#080B09" />
            <rect x="36" y="15" width="2" height="6" fill="#252E2C" />
            <rect x="36" y="16" width="2" height="4" fill="#99F018" className="ear-light" />

            {/* Casco Principal de la Cabeza */}
            <rect x="10" y="9" width="24" height="1" fill="#080B09" />
            <rect x="9" y="10" width="26" height="14" fill="#080B09" />
            <rect x="10" y="24" width="24" height="1" fill="#080B09" />

            {/* Relleno Verde Lima del Casco */}
            <rect x="11" y="10" width="22" height="1" fill="#B6FF3B" />
            <rect x="10" y="11" width="24" height="12" fill="#99F018" />
            {/* Sombreado inferior e izquierdo del casco */}
            <rect x="10" y="22" width="24" height="2" fill="#5CA800" />
            <rect x="10" y="12" width="2" height="10" fill="#70C904" />

            {/* Pantalla Negra del Rostro */}
            <rect x="13" y="12" width="18" height="1" fill="#080B09" />
            <rect x="12" y="13" width="20" height="8" fill="#080B09" />
            <rect x="13" y="21" width="18" height="1" fill="#080B09" />

            {/* Ojos de Píxeles */}
            <g className="robot-eyes">
              {/* Ojo Izquierdo */}
              <g className="eye-left">
                <rect x="15" y="15" width="4" height="4" fill="#28FF3E" />
                <rect x="16" y="14" width="2" height="6" fill="#28FF3E" />
                <rect x="16" y="15" width="2" height="2" fill="#9DFFAC" />
              </g>
              {/* Ojo Derecho */}
              <g className="eye-right">
                <rect x="25" y="15" width="4" height="4" fill="#28FF3E" />
                <rect x="26" y="14" width="2" height="6" fill="#28FF3E" />
                <rect x="26" y="15" width="2" height="2" fill="#9DFFAC" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
