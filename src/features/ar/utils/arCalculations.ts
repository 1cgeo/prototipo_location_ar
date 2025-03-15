// Path: features\ar\utils\arCalculations.ts
/**
 * Calcula a posição horizontal do marcador na tela
 * Inclui margem de segurança para evitar que marcadores sejam cortados nas bordas
 *
 * @param bearing Direção do marcador em relação ao usuário (em graus)
 * @param heading Direção para onde o usuário está olhando (em graus)
 * @param fieldOfView Campo de visão horizontal da câmera (em graus)
 * @param safeMargin Margem de segurança (0-0.2) para evitar cortes nas bordas
 * @returns Posição normalizada (0-1, onde 0 é extrema esquerda e 1 é extrema direita)
 */
export const calculateMarkerPosition = (
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
  safeMargin: number = 0.1, // 10% de margem de segurança em cada borda
): number => {
  // Diferença entre a direção do marcador e a direção da câmera
  let relativeBearing = bearing - heading;

  // Normaliza para intervalo -180 a 180
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // Converte para posição na tela (0-1)
  // 0 = extrema esquerda, 0.5 = centro, 1 = extrema direita
  const position = 0.5 + relativeBearing / fieldOfView;

  // Aplica a margem de segurança para evitar que marcadores sejam cortados nas bordas
  const safeMin = safeMargin;
  const safeMax = 1 - safeMargin;

  // Se o marcador estaria muito próximo das bordas, ajustamos para a zona segura
  if (position < safeMin) {
    // Está muito à esquerda, atraímos para a zona visível
    const visibilityFactor = position / safeMin;
    // Quanto mais próximo de 0, menor a visibilidade
    return safeMin * Math.max(0.2, visibilityFactor);
  } else if (position > safeMax) {
    // Está muito à direita, atraímos para a zona visível
    const visibilityFactor = (1 - position) / safeMargin;
    // Quanto mais próximo de 1, menor a visibilidade
    return safeMax + (position - safeMax) * Math.max(0.2, visibilityFactor);
  }

  // Caso contrário, mantém a posição calculada
  return position;
};

/**
 * Calcula o tamanho visual do marcador com base na distância
 * Melhorado para escala mais natural
 *
 * @param distance Distância em metros
 * @param customBaseSize Tamanho base opcional em pixels
 * @param minSize Tamanho mínimo em pixels
 * @returns Tamanho em pixels
 */
export const calculateMarkerSize = (
  distance: number,
  customBaseSize?: number,
  minSize: number = 30,
): number => {
  // Tamanho base em pixels (customizável ou padrão)
  const baseSize = customBaseSize || 60;

  // Fórmula logarítmica para uma redução mais natural baseada na distância
  // Marcadores próximos são maiores, mas a redução é mais gradual para distâncias maiores
  const factor = 1 - Math.min(0.8, Math.log10(distance / 10) / 3);
  const size = baseSize * Math.max(0.2, factor);

  return Math.max(minSize, size);
};

/**
 * Calcula a opacidade do marcador com base na distância
 * Inclui parâmetro minOpacity para garantir visibilidade mínima
 *
 * @param distance Distância em metros
 * @param maxDistance Distância máxima para visualização
 * @param minOpacity Opacidade mínima (0-1)
 * @returns Opacidade (0-1)
 */
export const calculateMarkerOpacity = (
  distance: number,
  maxDistance: number = 500,
  minOpacity: number = 0.4,
): number => {
  // Reduz a opacidade com a distância, mas mantém uma opacidade mínima
  return Math.max(minOpacity, Math.min(1, 1 - distance / maxDistance));
};

/**
 * Calcula a prioridade de um marcador com base na distância e ângulo
 * Marcadores mais centrais e próximos recebem prioridade maior
 *
 * @param distance Distância em metros
 * @param relativeBearing Ângulo relativo ao centro da tela (em graus)
 * @param fieldOfView Campo de visão (em graus)
 * @returns Valor de prioridade (maior é mais prioritário)
 */
export const calculateMarkerPriority = (
  distance: number,
  relativeBearing: number,
  fieldOfView: number = 60,
): number => {
  // Normaliza o ângulo para o intervalo -1 a 1, onde 0 é o centro
  const normalizedAngle = relativeBearing / (fieldOfView / 2);

  // Quanto mais próximo do centro, maior o valor (1 no centro, 0 nas bordas)
  const anglePriority = 1 - Math.min(1, Math.abs(normalizedAngle));

  // Quanto mais próximo, maior a prioridade
  const distancePriority = Math.max(0, 1 - distance / 500);

  // Combinamos as prioridades, dando mais peso à distância
  return distancePriority * 0.7 + anglePriority * 0.3;
};

/**
 * Determina se um marcador está dentro do campo de visão
 *
 * @param bearing Direção do marcador (em graus)
 * @param heading Direção para onde o usuário está olhando (em graus)
 * @param fieldOfView Campo de visão (em graus)
 * @param extendedMargin Margem adicional além do campo de visão (em graus)
 * @returns Verdadeiro se o marcador está visível
 */
export const isMarkerInView = (
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
  extendedMargin: number = 5,
): boolean => {
  // Diferença entre a direção do marcador e a direção da câmera
  let relativeBearing = bearing - heading;

  // Normaliza para intervalo -180 a 180
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // Adiciona uma margem extra para mostrar marcadores levemente fora do campo
  // Isso ajuda a evitar que marcadores apareçam/desapareçam abruptamente
  const extendedFOV = fieldOfView + extendedMargin * 2;

  // Verifica se está dentro do campo de visão estendido
  return Math.abs(relativeBearing) < extendedFOV / 2;
};
