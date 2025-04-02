// Path: features\ar\data\samplePOIs.ts
import { MarkersCollection, Marker } from '../schemas/markerSchema';

/**
 * Gera pontos de interesse aleatórios ao redor de uma localização
 *
 * @param centerLat Latitude central (localização atual do usuário)
 * @param centerLng Longitude central (localização atual do usuário)
 * @returns Coleção de POIs no formato GeoJSON
 */
export const generateSamplePOIs = (
  centerLat: number,
  centerLng: number,
): MarkersCollection => {
  // Categorias disponíveis
  const categories = [
    'restaurante',
    'loja',
    'atracao',
    'servico',
    'transporte',
  ];

  // Nomes de exemplo para cada categoria
  const names: Record<string, string[]> = {
    restaurante: [
      'Café Central',
      'Restaurante Bella Vita',
      'Padaria Estrela',
      'Bar do João',
      'Pizzaria Napoli',
    ],
    loja: [
      'Livraria Cultura',
      'Loja de Roupas Fashion',
      'Mercado Local',
      'Loja de Eletrônicos',
      'Artesanato Regional',
    ],
    atracao: [
      'Museu de Arte',
      'Mirante Panorâmico',
      'Teatro Municipal',
      'Galeria de Arte',
      'Monumento Histórico',
    ],
    servico: [
      'Farmácia 24h',
      'Banco Central',
      'Lotérica Sorte Grande',
      'Lavanderia Rápida',
      'Clínica Médica',
    ],
    transporte: [
      'Metrô Centro',
      'Ponto de Ônibus',
      'Estação de Trem',
      'Parada de Táxi',
      'Bicicletário Público',
    ],
  };

  // Descrições de exemplo
  const descriptions = [
    'Ambiente agradável com ótimo atendimento.',
    'Opções variadas para todos os gostos.',
    'Localização privilegiada e fácil acesso.',
    'Preços acessíveis e qualidade garantida.',
    'Atendimento 24 horas com profissionais qualificados.',
    'Ideal para visitação em família ou com amigos.',
    'Referência na região há mais de 20 anos.',
    'Ambiente moderno com infraestrutura completa.',
  ];

  // Gera pontos distribuídos em todas as direções para facilitar o teste
  const generateDirectionalMarkers = (count: number): Marker[] => {
    const markers: Marker[] = [];

    // Vamos distribuir os marcadores em diferentes direções e distâncias
    for (let i = 0; i < count; i++) {
      // Distribuir pontos em círculo ao redor do usuário
      // Ângulo em radianos (distribuído uniformemente em 360°)
      const angle = (i * 2 * Math.PI) / count;

      // Distância aleatória entre 50m e 300m (convertida para graus)
      // Isso garante que os marcadores estarão em distâncias curtas e visíveis
      const distanceMeters = 50 + Math.random() * 250;
      const distanceDegrees = distanceMeters / 111000; // Aproximação rápida de metros para graus

      // Calcula o deslocamento em latitude e longitude
      const latOffset = distanceDegrees * Math.cos(angle);
      const lngOffset =
        (distanceDegrees * Math.sin(angle)) /
        Math.cos((centerLat * Math.PI) / 180);

      // Calcula posição final
      const lat = centerLat + latOffset;
      const lng = centerLng + lngOffset;

      // Escolhe categoria aleatória
      const category = categories[i % categories.length];

      // Escolhe nome e descrição aleatórios
      const categoryNames = names[category] || names['restaurante'];
      const nameIndex = i % categoryNames.length;
      const name = categoryNames[nameIndex];
      const description = descriptions[i % descriptions.length];

      // Adiciona o marcador
      markers.push({
        id: (i + 1).toString(),
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          name,
          category,
          description,
          icon: category,
        },
      });
    }

    return markers;
  };

  // Retorna a coleção de POIs com pontos distribuídos ao redor do usuário
  return {
    type: 'FeatureCollection',
    features: generateDirectionalMarkers(12),
  };
};

// Conjunto inicial vazio para marcadores
// Será preenchido quando a localização do usuário estiver disponível
export const samplePOIs: MarkersCollection = {
  type: 'FeatureCollection',
  features: [],
};
