// Path: features\ar\data\samplePOIs.ts
import { MarkersCollection, Marker } from '../schemas/markerSchema';

/**
 * Gera pontos de interesse aleatórios ao redor de uma localização
 * Versão melhorada com menos POIs, categorias diversas e diferentes distâncias
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
    'cafeteria',
    'loja',
    'atracao',
    'teatro',
    'servico',
    'transporte',
  ];

  // Nomes de exemplo para cada categoria (mais diversificados)
  const names: Record<string, string[]> = {
    restaurante: [
      'Cantina Italiana',
      'Boteco do Chico',
      'Bistrô Paris',
      'Churrascaria Brasa',
      'Sushi Express',
    ],
    cafeteria: [
      'Café do Porto',
      'Coffee & Co',
      'Padaria Aurora',
      'Doces & Cia',
      'Confeitaria Sublime',
    ],
    loja: [
      'Livraria Cultura',
      'Moda Fashion',
      'Eletrônicos Tech',
      'Artesanato Regional',
      'Shopping Central',
    ],
    atracao: [
      'Museu de História',
      'Parque da Cidade',
      'Galeria de Arte',
      'Mirante Vista Alta',
      'Monumento Histórico',
    ],
    teatro: [
      'Teatro Municipal',
      'Casa de Shows',
      'Cinema Paradiso',
      'Espaço Cultural',
      'Arena de Eventos',
    ],
    servico: [
      'Farmácia 24h',
      'Banco Central',
      'Hospital São Lucas',
      'Correios',
      'Lavanderia Expressa',
    ],
    transporte: [
      'Estação Metro',
      'Terminal de Ônibus',
      'Ponto de Táxi',
      'Bicicletário Público',
      'Aeroporto Regional',
    ],
  };

  // Descrições de exemplo (mais detalhadas)
  const descriptions = [
    'Local aconchegante com ambiente familiar e ótimo atendimento. Perfeito para visitar com amigos ou família.',
    'Estabelecimento moderno com excelente infraestrutura e preços acessíveis para todos os públicos.',
    'Ponto de referência na região, conhecido pela qualidade e tradição há mais de 20 anos no mercado.',
    'Ambiente agradável e serviço de primeira qualidade. Vale a pena conhecer!',
    'Espaço amplo com estacionamento e facilidades de acesso para todos os visitantes.',
    'Atendimento personalizado com profissionais qualificados. Venha conferir!',
    'Localização privilegiada no centro da cidade, próximo a diversos pontos turísticos.',
    'Opções variadas para todos os gostos, com produtos exclusivos e atendimento premium.',
  ];

  /**
   * Gera marcadores distribuídos em diferentes distâncias e direções
   * Versão melhorada com menor número de POIs e melhor distribuição
   */
  const generateDistributedMarkers = (): Marker[] => {
    const markers: Marker[] = [];
    const usedCategories: Set<string> = new Set();
    
    // Total reduzido de POIs
    const TOTAL_POIS = 7;
    
    // Categorias que já foram usadas para marcadores próximos
    const nearbyUsedCategories: Set<string> = new Set();
    
    // Gerar POIs com diferentes distâncias
    for (let i = 0; i < TOTAL_POIS; i++) {
      // Distribuir pontos em círculo ao redor do usuário
      // Ângulo distribuído uniformemente (divide o círculo em partes iguais)
      const angle = (i * (2 * Math.PI) / TOTAL_POIS) + (Math.random() * 0.2 - 0.1);
      
      // Determine a distância baseada na posição
      // Alguns pontos próximos, outros médios, outros distantes
      let distanceMeters: number;
      
      if (i % 3 === 0) { 
        // Próximo (50-150m)
        distanceMeters = 50 + Math.random() * 100;
      } else if (i % 3 === 1) { 
        // Médio (150-300m)
        distanceMeters = 150 + Math.random() * 150;
      } else { 
        // Distante (300-450m)
        distanceMeters = 300 + Math.random() * 150;
      }
      
      // Adiciona pequena variação aleatória à distância
      distanceMeters *= (0.9 + Math.random() * 0.2);
      
      // Conversão para graus
      const distanceDegrees = distanceMeters / 111000;
      
      // Calcula deslocamento
      const latOffset = distanceDegrees * Math.cos(angle);
      const lngOffset = distanceDegrees * Math.sin(angle) / Math.cos((centerLat * Math.PI) / 180);
      
      // Posição final
      const lat = centerLat + latOffset;
      const lng = centerLng + lngOffset;
      
      // Seleção de categoria - garantindo diversidade
      // Para POIs próximos, garantir categorias diferentes
      let category: string;
      
      if (distanceMeters < 200) {
        // Para POIs próximos, nunca usar a mesma categoria
        do {
          category = categories[Math.floor(Math.random() * categories.length)];
        } while (nearbyUsedCategories.has(category));
        
        nearbyUsedCategories.add(category);
      } else {
        // Para POIs distantes, tentar não repetir categorias se possível
        if (usedCategories.size < categories.length) {
          do {
            category = categories[Math.floor(Math.random() * categories.length)];
          } while (usedCategories.has(category));
        } else {
          // Se já usamos todas as categorias, escolhe qualquer uma
          category = categories[Math.floor(Math.random() * categories.length)];
        }
      }
      
      usedCategories.add(category);
      
      // Nome aleatório da categoria
      const categoryNames = names[category] || names['restaurante'];
      const nameIndex = Math.floor(Math.random() * categoryNames.length);
      const name = categoryNames[nameIndex];
      
      // Descrição aleatória
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];
      
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

  // Retorna a coleção de POIs aprimorada
  return {
    type: 'FeatureCollection',
    features: generateDistributedMarkers(),
  };
};

// Conjunto inicial vazio para marcadores
// Será preenchido quando a localização do usuário estiver disponível
export const samplePOIs: MarkersCollection = {
  type: 'FeatureCollection',
  features: [],
};