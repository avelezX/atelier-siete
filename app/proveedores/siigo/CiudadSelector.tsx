'use client';
import { useState, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';

interface Ciudad {
  code: string;
  state: string;
  label: string;
  dept: string;
}

// Municipios de Colombia con códigos DIVIPOLA
const CIUDADES: Ciudad[] = [
  // Amazonas
  { code: '91001', state: '91', label: 'Leticia', dept: 'Amazonas' },
  // Antioquia
  { code: '05001', state: '05', label: 'Medellín', dept: 'Antioquia' },
  { code: '05088', state: '05', label: 'Bello', dept: 'Antioquia' },
  { code: '05266', state: '05', label: 'Envigado', dept: 'Antioquia' },
  { code: '05360', state: '05', label: 'Itagüí', dept: 'Antioquia' },
  { code: '05376', state: '05', label: 'La Estrella', dept: 'Antioquia' },
  { code: '05380', state: '05', label: 'Caldas', dept: 'Antioquia' },
  { code: '05615', state: '05', label: 'Rionegro', dept: 'Antioquia' },
  { code: '05045', state: '05', label: 'Apartadó', dept: 'Antioquia' },
  { code: '05837', state: '05', label: 'Turbo', dept: 'Antioquia' },
  { code: '05154', state: '05', label: 'Caucasia', dept: 'Antioquia' },
  { code: '05790', state: '05', label: 'Sabaneta', dept: 'Antioquia' },
  // Arauca
  { code: '81001', state: '81', label: 'Arauca', dept: 'Arauca' },
  // Atlántico
  { code: '08001', state: '08', label: 'Barranquilla', dept: 'Atlántico' },
  { code: '08078', state: '08', label: 'Baranoa', dept: 'Atlántico' },
  { code: '08372', state: '08', label: 'Juan de Acosta', dept: 'Atlántico' },
  { code: '08433', state: '08', label: 'Malambo', dept: 'Atlántico' },
  { code: '08520', state: '08', label: 'Palmar de Varela', dept: 'Atlántico' },
  { code: '08549', state: '08', label: 'Sabanagrande', dept: 'Atlántico' },
  { code: '08558', state: '08', label: 'Sabanalarga', dept: 'Atlántico' },
  { code: '08573', state: '08', label: 'Santa Lucía', dept: 'Atlántico' },
  { code: '08606', state: '08', label: 'Soledad', dept: 'Atlántico' },
  // Bogotá D.C.
  { code: '11001', state: '11', label: 'Bogotá D.C.', dept: 'Bogotá D.C.' },
  // Bolívar
  { code: '13001', state: '13', label: 'Cartagena', dept: 'Bolívar' },
  { code: '13430', state: '13', label: 'Magangué', dept: 'Bolívar' },
  { code: '13490', state: '13', label: 'Mompós', dept: 'Bolívar' },
  // Boyacá
  { code: '15001', state: '15', label: 'Tunja', dept: 'Boyacá' },
  { code: '15176', state: '15', label: 'Chiquinquirá', dept: 'Boyacá' },
  { code: '15238', state: '15', label: 'Duitama', dept: 'Boyacá' },
  { code: '15693', state: '15', label: 'Sogamoso', dept: 'Boyacá' },
  // Caldas
  { code: '17001', state: '17', label: 'Manizales', dept: 'Caldas' },
  { code: '17042', state: '17', label: 'Anserma', dept: 'Caldas' },
  { code: '17380', state: '17', label: 'La Dorada', dept: 'Caldas' },
  { code: '17541', state: '17', label: 'Riosucio', dept: 'Caldas' },
  // Caquetá
  { code: '18001', state: '18', label: 'Florencia', dept: 'Caquetá' },
  // Casanare
  { code: '85001', state: '85', label: 'Yopal', dept: 'Casanare' },
  { code: '85010', state: '85', label: 'Aguazul', dept: 'Casanare' },
  // Cauca
  { code: '19001', state: '19', label: 'Popayán', dept: 'Cauca' },
  { code: '19698', state: '19', label: 'Santander de Quilichao', dept: 'Cauca' },
  // Cesar
  { code: '20001', state: '20', label: 'Valledupar', dept: 'Cesar' },
  { code: '20228', state: '20', label: 'Codazzi', dept: 'Cesar' },
  { code: '20383', state: '20', label: 'La Jagua de Ibirico', dept: 'Cesar' },
  // Chocó
  { code: '27001', state: '27', label: 'Quibdó', dept: 'Chocó' },
  // Córdoba
  { code: '23001', state: '23', label: 'Montería', dept: 'Córdoba' },
  { code: '23417', state: '23', label: 'Lorica', dept: 'Córdoba' },
  { code: '23466', state: '23', label: 'Montelíbano', dept: 'Córdoba' },
  // Cundinamarca
  { code: '25175', state: '25', label: 'Chía', dept: 'Cundinamarca' },
  { code: '25269', state: '25', label: 'Facatativá', dept: 'Cundinamarca' },
  { code: '25290', state: '25', label: 'Fusagasugá', dept: 'Cundinamarca' },
  { code: '25307', state: '25', label: 'Girardot', dept: 'Cundinamarca' },
  { code: '25386', state: '25', label: 'La Mesa', dept: 'Cundinamarca' },
  { code: '25430', state: '25', label: 'Madrid', dept: 'Cundinamarca' },
  { code: '25473', state: '25', label: 'Mosquera', dept: 'Cundinamarca' },
  { code: '25486', state: '25', label: 'Nemocón', dept: 'Cundinamarca' },
  { code: '25513', state: '25', label: 'Pacho', dept: 'Cundinamarca' },
  { code: '25612', state: '25', label: 'Ricaurte', dept: 'Cundinamarca' },
  { code: '25754', state: '25', label: 'Soacha', dept: 'Cundinamarca' },
  { code: '25758', state: '25', label: 'Sopó', dept: 'Cundinamarca' },
  { code: '25769', state: '25', label: 'Subachoque', dept: 'Cundinamarca' },
  { code: '25772', state: '25', label: 'Suesca', dept: 'Cundinamarca' },
  { code: '25785', state: '25', label: 'Tabio', dept: 'Cundinamarca' },
  { code: '25817', state: '25', label: 'Tocancipá', dept: 'Cundinamarca' },
  { code: '25899', state: '25', label: 'Zipaquirá', dept: 'Cundinamarca' },
  { code: '25214', state: '25', label: 'Cota', dept: 'Cundinamarca' },
  { code: '25035', state: '25', label: 'Anapoima', dept: 'Cundinamarca' },
  { code: '25040', state: '25', label: 'Anolaima', dept: 'Cundinamarca' },
  { code: '25053', state: '25', label: 'Arbeláez', dept: 'Cundinamarca' },
  // Guainía
  { code: '94001', state: '94', label: 'Inírida', dept: 'Guainía' },
  // Guaviare
  { code: '95001', state: '95', label: 'San José del Guaviare', dept: 'Guaviare' },
  // Huila
  { code: '41001', state: '41', label: 'Neiva', dept: 'Huila' },
  { code: '41132', state: '41', label: 'Campoalegre', dept: 'Huila' },
  { code: '41298', state: '41', label: 'Garzón', dept: 'Huila' },
  { code: '41306', state: '41', label: 'Gigante', dept: 'Huila' },
  { code: '41503', state: '41', label: 'Pitalito', dept: 'Huila' },
  // La Guajira
  { code: '44001', state: '44', label: 'Riohacha', dept: 'La Guajira' },
  { code: '44430', state: '44', label: 'Maicao', dept: 'La Guajira' },
  // Magdalena
  { code: '47001', state: '47', label: 'Santa Marta', dept: 'Magdalena' },
  { code: '47189', state: '47', label: 'Ciénaga', dept: 'Magdalena' },
  { code: '47460', state: '47', label: 'Fundación', dept: 'Magdalena' },
  // Meta
  { code: '50001', state: '50', label: 'Villavicencio', dept: 'Meta' },
  { code: '50006', state: '50', label: 'Acacías', dept: 'Meta' },
  { code: '50150', state: '50', label: 'Castilla la Nueva', dept: 'Meta' },
  { code: '50226', state: '50', label: 'Cumaral', dept: 'Meta' },
  // Nariño
  { code: '52001', state: '52', label: 'Pasto', dept: 'Nariño' },
  { code: '52835', state: '52', label: 'Tumaco', dept: 'Nariño' },
  { code: '52356', state: '52', label: 'Ipiales', dept: 'Nariño' },
  // Norte de Santander
  { code: '54001', state: '54', label: 'Cúcuta', dept: 'Norte de Santander' },
  { code: '54206', state: '54', label: 'Convención', dept: 'Norte de Santander' },
  { code: '54405', state: '54', label: 'Los Patios', dept: 'Norte de Santander' },
  { code: '54498', state: '54', label: 'Ocaña', dept: 'Norte de Santander' },
  { code: '54518', state: '54', label: 'Pamplona', dept: 'Norte de Santander' },
  { code: '54553', state: '54', label: 'Puerto Santander', dept: 'Norte de Santander' },
  { code: '54720', state: '54', label: 'Sardinata', dept: 'Norte de Santander' },
  { code: '54810', state: '54', label: 'Villa del Rosario', dept: 'Norte de Santander' },
  // Putumayo
  { code: '86001', state: '86', label: 'Mocoa', dept: 'Putumayo' },
  // Quindío
  { code: '63001', state: '63', label: 'Armenia', dept: 'Quindío' },
  { code: '63111', state: '63', label: 'Calarcá', dept: 'Quindío' },
  { code: '63130', state: '63', label: 'Circasia', dept: 'Quindío' },
  { code: '63212', state: '63', label: 'Filandia', dept: 'Quindío' },
  { code: '63401', state: '63', label: 'La Tebaida', dept: 'Quindío' },
  { code: '63470', state: '63', label: 'Montenegro', dept: 'Quindío' },
  { code: '63548', state: '63', label: 'Quimbaya', dept: 'Quindío' },
  // Risaralda
  { code: '66001', state: '66', label: 'Pereira', dept: 'Risaralda' },
  { code: '66045', state: '66', label: 'Apía', dept: 'Risaralda' },
  { code: '66170', state: '66', label: 'Dosquebradas', dept: 'Risaralda' },
  { code: '66400', state: '66', label: 'La Virginia', dept: 'Risaralda' },
  { code: '66440', state: '66', label: 'Marsella', dept: 'Risaralda' },
  { code: '66572', state: '66', label: 'Santa Rosa de Cabal', dept: 'Risaralda' },
  // San Andrés
  { code: '88001', state: '88', label: 'San Andrés', dept: 'San Andrés y Providencia' },
  // Santander
  { code: '68001', state: '68', label: 'Bucaramanga', dept: 'Santander' },
  { code: '68081', state: '68', label: 'Barrancabermeja', dept: 'Santander' },
  { code: '68276', state: '68', label: 'Floridablanca', dept: 'Santander' },
  { code: '68307', state: '68', label: 'Girón', dept: 'Santander' },
  { code: '68418', state: '68', label: 'Lebrija', dept: 'Santander' },
  { code: '68547', state: '68', label: 'Piedecuesta', dept: 'Santander' },
  { code: '68569', state: '68', label: 'Pinchote', dept: 'Santander' },
  { code: '68615', state: '68', label: 'Rionegro', dept: 'Santander' },
  { code: '68679', state: '68', label: 'San Gil', dept: 'Santander' },
  { code: '68755', state: '68', label: 'Socorro', dept: 'Santander' },
  { code: '68780', state: '68', label: 'Suaita', dept: 'Santander' },
  { code: '68820', state: '68', label: 'Vélez', dept: 'Santander' },
  // Sucre
  { code: '70001', state: '70', label: 'Sincelejo', dept: 'Sucre' },
  { code: '70215', state: '70', label: 'Corozal', dept: 'Sucre' },
  // Tolima
  { code: '73001', state: '73', label: 'Ibagué', dept: 'Tolima' },
  { code: '73024', state: '73', label: 'Alpujarra', dept: 'Tolima' },
  { code: '73043', state: '73', label: 'Anzoátegui', dept: 'Tolima' },
  { code: '73148', state: '73', label: 'Carmen de Apicalá', dept: 'Tolima' },
  { code: '73168', state: '73', label: 'Chaparral', dept: 'Tolima' },
  { code: '73226', state: '73', label: 'Espinal', dept: 'Tolima' },
  { code: '73236', state: '73', label: 'Falan', dept: 'Tolima' },
  { code: '73268', state: '73', label: 'Flandes', dept: 'Tolima' },
  { code: '73349', state: '73', label: 'Honda', dept: 'Tolima' },
  { code: '73408', state: '73', label: 'Lerida', dept: 'Tolima' },
  { code: '73411', state: '73', label: 'Líbano', dept: 'Tolima' },
  { code: '73443', state: '73', label: 'Melgar', dept: 'Tolima' },
  { code: '73461', state: '73', label: 'Murillo', dept: 'Tolima' },
  { code: '73520', state: '73', label: 'Purificación', dept: 'Tolima' },
  { code: '73678', state: '73', label: 'San Sebastián de Mariquita', dept: 'Tolima' },
  { code: '73686', state: '73', label: 'Saldaña', dept: 'Tolima' },
  { code: '73770', state: '73', label: 'Suárez', dept: 'Tolima' },
  // Valle del Cauca
  { code: '76001', state: '76', label: 'Cali', dept: 'Valle del Cauca' },
  { code: '76020', state: '76', label: 'Alcalá', dept: 'Valle del Cauca' },
  { code: '76036', state: '76', label: 'Andalucía', dept: 'Valle del Cauca' },
  { code: '76041', state: '76', label: 'Ansermanuevo', dept: 'Valle del Cauca' },
  { code: '76054', state: '76', label: 'Argelia', dept: 'Valle del Cauca' },
  { code: '76100', state: '76', label: 'Bolívar', dept: 'Valle del Cauca' },
  { code: '76109', state: '76', label: 'Buenaventura', dept: 'Valle del Cauca' },
  { code: '76111', state: '76', label: 'Guadalajara de Buga', dept: 'Valle del Cauca' },
  { code: '76113', state: '76', label: 'Bugalagrande', dept: 'Valle del Cauca' },
  { code: '76122', state: '76', label: 'Caicedonia', dept: 'Valle del Cauca' },
  { code: '76126', state: '76', label: 'Calima', dept: 'Valle del Cauca' },
  { code: '76130', state: '76', label: 'Candelaria', dept: 'Valle del Cauca' },
  { code: '76147', state: '76', label: 'Cartago', dept: 'Valle del Cauca' },
  { code: '76233', state: '76', label: 'Dagua', dept: 'Valle del Cauca' },
  { code: '76243', state: '76', label: 'El Águila', dept: 'Valle del Cauca' },
  { code: '76246', state: '76', label: 'El Cairo', dept: 'Valle del Cauca' },
  { code: '76248', state: '76', label: 'El Cerrito', dept: 'Valle del Cauca' },
  { code: '76250', state: '76', label: 'El Dovio', dept: 'Valle del Cauca' },
  { code: '76275', state: '76', label: 'Florida', dept: 'Valle del Cauca' },
  { code: '76306', state: '76', label: 'Ginebra', dept: 'Valle del Cauca' },
  { code: '76318', state: '76', label: 'Guacarí', dept: 'Valle del Cauca' },
  { code: '76364', state: '76', label: 'Jamundí', dept: 'Valle del Cauca' },
  { code: '76377', state: '76', label: 'La Cumbre', dept: 'Valle del Cauca' },
  { code: '76400', state: '76', label: 'La Unión', dept: 'Valle del Cauca' },
  { code: '76403', state: '76', label: 'La Victoria', dept: 'Valle del Cauca' },
  { code: '76497', state: '76', label: 'Obando', dept: 'Valle del Cauca' },
  { code: '76520', state: '76', label: 'Palmira', dept: 'Valle del Cauca' },
  { code: '76563', state: '76', label: 'Pradera', dept: 'Valle del Cauca' },
  { code: '76606', state: '76', label: 'Restrepo', dept: 'Valle del Cauca' },
  { code: '76616', state: '76', label: 'Riofrío', dept: 'Valle del Cauca' },
  { code: '76622', state: '76', label: 'Roldanillo', dept: 'Valle del Cauca' },
  { code: '76670', state: '76', label: 'San Pedro', dept: 'Valle del Cauca' },
  { code: '76736', state: '76', label: 'Sevilla', dept: 'Valle del Cauca' },
  { code: '76823', state: '76', label: 'Toro', dept: 'Valle del Cauca' },
  { code: '76828', state: '76', label: 'Trujillo', dept: 'Valle del Cauca' },
  { code: '76834', state: '76', label: 'Tuluá', dept: 'Valle del Cauca' },
  { code: '76845', state: '76', label: 'Ulloa', dept: 'Valle del Cauca' },
  { code: '76863', state: '76', label: 'Versalles', dept: 'Valle del Cauca' },
  { code: '76869', state: '76', label: 'Vijes', dept: 'Valle del Cauca' },
  { code: '76890', state: '76', label: 'Yotoco', dept: 'Valle del Cauca' },
  { code: '76892', state: '76', label: 'Yumbo', dept: 'Valle del Cauca' },
  { code: '76895', state: '76', label: 'Zarzal', dept: 'Valle del Cauca' },
  // Vaupés
  { code: '97001', state: '97', label: 'Mitú', dept: 'Vaupés' },
  // Vichada
  { code: '99001', state: '99', label: 'Puerto Carreño', dept: 'Vichada' },
];

interface Props {
  value: string;
  onChange: (code: string, state: string, label: string) => void;
}

export default function CiudadSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = CIUDADES.find(c => c.code === value);

  const filtered = query.length >= 2
    ? CIUDADES.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.dept.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 40)
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(c: Ciudad) {
    onChange(c.code, c.state, c.label);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('', '', '');
  }

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        // Ciudad seleccionada
        <div
          onClick={() => { setOpen(true); setQuery(''); }}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm cursor-pointer hover:border-blue-400 flex items-center justify-between bg-white"
        >
          <span className="flex items-center gap-2 text-gray-900">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {selected.label}
            <span className="text-gray-400 text-xs">— {selected.dept}</span>
          </span>
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        // Input de búsqueda
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            autoFocus={open}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar ciudad o departamento..."
            className="w-full pl-8 pr-3.5 py-2.5 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {!selected && !query && (
            <div className="px-4 py-3 text-xs text-gray-400">Escribe al menos 2 caracteres para buscar</div>
          )}
          {query.length >= 2 && filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Sin resultados para &quot;{query}&quot;</div>
          )}
          {filtered.length > 0 && (
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.map(c => (
                <li
                  key={c.code}
                  onMouseDown={() => handleSelect(c)}
                  className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900">{c.label}</span>
                  <span className="text-xs text-gray-400 ml-3 shrink-0">{c.dept}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
