/** 외부 세무 원장 ZIP/XLSX 컨테이너의 무해성 판단. 값·파일명은 받지 않는다. */
export const TAX_CONTAINER_LIMITS = Object.freeze({
  maxOriginalBytes: 100 * 1024 * 1024,
  maxEntryCount: 5_000,
  maxMemberBytes: 100 * 1024 * 1024,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 100,
});

const number = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const unique = (values) => [...new Set(values)].sort();

/**
 * entries는 Python ZIP reader가 만든 구조 메타데이터다. 이름/셀값은 이 함수에 전달하지 않는다.
 * `kind=ARCHIVE`는 xlsx를 담은 외부 ZIP, `kind=XLSX`는 Office workbook 내부 ZIP을 뜻한다.
 */
export function assessTaxContainer({ kind, entries = [], hasContentTypes = false, hasWorkbookXml = false, hasMacroPayload = false, hasExternalDependency = false, hasOversizedMetadataEntry = false } = {}) {
  const holds = [];
  if (!['ARCHIVE', 'XLSX'].includes(kind)) holds.push('HOLD_CONTAINER_KIND_UNSUPPORTED');
  if (!Array.isArray(entries) || entries.length === 0) holds.push('HOLD_CONTAINER_EMPTY');
  if (entries.length > TAX_CONTAINER_LIMITS.maxEntryCount) holds.push('HOLD_CONTAINER_ENTRY_COUNT_LIMIT');
  const files = (entries ?? []).filter((entry) => !entry.isDirectory);
  const total = files.reduce((sum, entry) => sum + number(entry.fileSize), 0);
  if (total > TAX_CONTAINER_LIMITS.maxTotalUncompressedBytes) holds.push('HOLD_CONTAINER_TOTAL_SIZE_LIMIT');
  for (const entry of files) {
    if (entry.unsafePath) holds.push('HOLD_CONTAINER_PATH_UNSAFE');
    if (entry.encrypted) holds.push('HOLD_CONTAINER_ENCRYPTED_MEMBER');
    const fileSize = number(entry.fileSize);
    const compressedSize = number(entry.compressedSize);
    if (fileSize > TAX_CONTAINER_LIMITS.maxMemberBytes) holds.push('HOLD_CONTAINER_MEMBER_SIZE_LIMIT');
    if (fileSize > 0 && compressedSize > 0 && fileSize / compressedSize > TAX_CONTAINER_LIMITS.maxCompressionRatio) holds.push('HOLD_CONTAINER_COMPRESSION_RATIO');
  }
  if (kind === 'XLSX' && (!hasContentTypes || !hasWorkbookXml)) holds.push('HOLD_XLSX_CONTAINER_INVALID');
  if (kind === 'XLSX' && hasMacroPayload) holds.push('HOLD_XLSX_MACRO_CONTENT');
  if (kind === 'XLSX' && hasExternalDependency) holds.push('HOLD_XLSX_EXTERNAL_DEPENDENCY');
  if (kind === 'XLSX' && hasOversizedMetadataEntry) holds.push('HOLD_XLSX_METADATA_ENTRY_LIMIT');
  return {
    holds: unique(holds),
    safeXlsxMemberIndexes: holds.length === 0 ? files.filter((entry) => entry.isXlsx).map((entry) => entry.index) : [],
  };
}
