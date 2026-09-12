import { LogicalPin, PackageMapping } from "../types/componentLibrary";

export function mappingEntries(mapping: PackageMapping): [string, string[]][] {
  return [...new Set([...Object.keys(mapping.pinMap), ...Object.keys(mapping.multiPinMap ?? {})])]
    .map((key) => [key, [...new Set([
      ...(typeof mapping.pinMap[key] === "string" && mapping.pinMap[key] ? [mapping.pinMap[key]] : []),
      ...(mapping.multiPinMap?.[key] ?? []),
    ])]] as [string, string[]]);
}

export function mappedPads(mapping: PackageMapping | undefined, pin: LogicalPin): string[] {
  if (!mapping) return [];
  const key = Object.prototype.hasOwnProperty.call(mapping.pinMap, pin.id) ||
    Object.prototype.hasOwnProperty.call(mapping.multiPinMap ?? {}, pin.id) ? pin.id : pin.name;
  const primary = mapping.pinMap[key];
  const multiple = mapping.multiPinMap?.[key];
  return [...new Set([...(typeof primary === "string" && primary ? [primary] : []),
    ...(Array.isArray(multiple) ? multiple : [])])];
}

export function setMappedPads(mapping: PackageMapping, pinId: string, pads: string[]): PackageMapping {
  const pinMap = { ...mapping.pinMap }, multiPinMap = { ...mapping.multiPinMap };
  delete pinMap[pinId];
  delete multiPinMap[pinId];
  const unique = [...new Set(pads.filter(Boolean))];
  return {
    ...mapping,
    pinMap: unique.length ? { ...pinMap, [pinId]: unique[0] } : pinMap,
    multiPinMap: unique.length > 1 ? { ...multiPinMap, [pinId]: unique } : multiPinMap,
  };
}

export function normalizeDeviceMapping(pins: LogicalPin[], mappings: PackageMapping[]) {
  const logicalPins = [...pins];
  for (const mapping of mappings) for (const [key] of mappingEntries(mapping)) {
    if (!logicalPins.some((pin) => pin.id === key) && logicalPins.filter((pin) => pin.name === key).length !== 1)
      logicalPins.push({ id: key, name: key, electricalType: "passive" });
  }
  const supportedPackages = mappings.map((mapping) => {
    let result: PackageMapping = { ...mapping, pinMap: {}, multiPinMap: {} };
    for (const [key, pads] of mappingEntries(mapping)) {
      const pin = logicalPins.find((p) => p.id === key) ?? logicalPins.find((p) => p.name === key);
      if (pin) result = setMappedPads(result, pin.id,
        [...(mappingEntries(result).find(([id]) => id === pin.id)?.[1] ?? []), ...pads]);
    }
    return result;
  });
  return { logicalPins, supportedPackages };
}

export function mappingError(mapping: PackageMapping, pins: LogicalPin[], padNumbers: Set<string>): string | null {
  const owners = new Map<string, string>();
  for (const [key, pads] of mappingEntries(mapping)) {
    const pin = pins.find((p) => p.id === key);
    if (!pin) return `Неизвестный логический вывод: ${key}.`;
    for (const pad of pads) {
      if (!padNumbers.has(pad)) return `Площадка ${pad} отсутствует в корпусе.`;
      const owner = owners.get(pad);
      if (owner && owner !== key) return `Площадка ${pad} назначена нескольким выводам. Сначала снимите лишнюю связь.`;
      owners.set(pad, key);
    }
  }
  return null;
}
