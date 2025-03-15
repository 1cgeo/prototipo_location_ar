// Path: features\ar\data\samplePOIs.ts
import { MarkersCollection, Marker } from '../schemas/markerSchema';

/**
 * Gera um conjunto de pontos de interesse aleatórios ao redor de uma localização
 *
 * @param centerLat Latitude central (se não fornecida, usa a posição padrão em São Paulo)
 * @param centerLng Longitude central (se não fornecida, usa a posição padrão em São Paulo)
 * @returns Coleção de POIs no formato GeoJSON
 */
const generateSamplePOIs = (
  centerLat?: number,
  centerLng?: number,
): MarkersCollection => {
  // Pontos centrais padrão (São Paulo - Praça da Sé)
  const defaultLat = -23.55052;
  const defaultLng = -46.633308;

  // Usa os pontos fornecidos ou os padrões
  const baseLat = centerLat ?? defaultLat;
  const baseLng = centerLng ?? defaultLng;

  // Categorias e seus ícones correspondentes
  const categories = [
    { id: 'restaurante', name: 'Restaurante', icon: 'restaurant' },
    { id: 'loja', name: 'Loja', icon: 'store' },
    { id: 'atracao', name: 'Atração Turística', icon: 'museum' },
    { id: 'servico', name: 'Serviço', icon: 'local_pharmacy' },
    { id: 'transporte', name: 'Transporte', icon: 'subway' },
  ];

  // Nomes de exemplo para cada categoria
  const names = {
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

  // Descrições de exemplo para cada categoria
  const descriptions = {
    restaurante: [
      'Café com ambiente agradável e ótimos lanches',
      'Cozinha tradicional com um toque moderno',
      'Opções vegetarianas e veganas disponíveis',
      'Especializado em pratos locais e regionais',
      'Ótimas opções de café da manhã e brunch',
    ],
    loja: [
      'Grande variedade de produtos e marcas',
      'Produtos artesanais e feitos à mão',
      'Ofertas especiais e descontos frequentes',
      'Atendimento personalizado e produtos exclusivos',
      'Especializada em produtos sustentáveis',
    ],
    atracao: [
      'Exposições temporárias e acervo permanente',
      'Vista panorâmica da cidade e região',
      'Patrimônio histórico com guias disponíveis',
      'Atividades culturais e educativas',
      'Local icônico para fotos e turismo',
    ],
    servico: [
      'Atendimento 24 horas e entregas',
      'Serviço rápido e eficiente',
      'Profissionais altamente qualificados',
      'Preços competitivos e bom atendimento',
      'Diversas opções de pagamento aceitas',
    ],
    transporte: [
      'Conexões para várias linhas de transporte',
      'Horários frequentes e pontuais',
      'Fácil acesso e bem localizado',
      'Opções de integração com outros transportes',
      'Ambiente seguro e bem iluminado',
    ],
  };

  // Gera pontos aleatórios em um raio de aproximadamente 300m
  const generateRandomPoints = (count: number): Marker[] => {
    const points: Marker[] = [];

    for (let i = 0; i < count; i++) {
      // Gera deslocamento aleatório entre -0.003 e 0.003 graus (~ 300m)
      const latOffset = Math.random() * 0.006 - 0.003;
      const lngOffset = Math.random() * 0.006 - 0.003;

      // Calcula posição
      const lat = baseLat + latOffset;
      const lng = baseLng + lngOffset;

      // Escolhe categoria aleatória
      const category =
        categories[Math.floor(Math.random() * categories.length)];

      // Escolhe nome e descrição aleatórios para a categoria
      const nameArray = names[category.id as keyof typeof names];
      const descArray = descriptions[category.id as keyof typeof descriptions];

      const name = nameArray[Math.floor(Math.random() * nameArray.length)];
      const description =
        descArray[Math.floor(Math.random() * descArray.length)];

      // Adiciona o ponto com tipos corretos
      points.push({
        id: (i + 1).toString(),
        type: 'Feature' as const, // Tipo literal "Feature" como esperado
        geometry: {
          type: 'Point' as const, // Tipo literal "Point" como esperado
          coordinates: [lng, lat] as [number, number], // Tupla explícita como esperado
        },
        properties: {
          name,
          category: category.id,
          description,
          icon: category.icon,
        },
      });
    }

    return points;
  };

  // Retorna a coleção de POIs com 10 pontos aleatórios
  return {
    type: 'FeatureCollection' as const, // Tipo literal como esperado
    features: generateRandomPoints(10),
  };
};

// Dados de exemplo para pontos de interesse (POIs)
// Usando a função de geração com valores padrão
export const samplePOIs: MarkersCollection = generateSamplePOIs();

// Nota: Para testes reais, você pode chamar generateSamplePOIs
// com sua localização atual como parâmetro
