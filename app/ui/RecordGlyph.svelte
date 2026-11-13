<script>
  // The shape a record shows: a symbol on an SVG sprite sheet, one cell of a raster atlas sheet,
  // or a glyph image cut from its document. Atlas sheets hold 16 × 16 cells of 64 pixels.
  /** @type {{ record: import('../lib/charsets.js').ProposalRecord }} */
  let { record } = $props()
  const COLUMNS = 16
  const CELL = 64
</script>

{#if record.sprite}
  <svg class="record-glyph" viewBox="0 0 200 200" aria-hidden="true"><use href={`/charsets/ebag-sprites/${record.sprite.sheet}.svg#${record.sprite.symbol}`}></use></svg>
{:else if record.atlas}
  <svg class="record-glyph" viewBox={`-6 -6 ${CELL + 12} ${CELL + 12}`} aria-hidden="true">
    <svg width={CELL} height={CELL} viewBox={`${(record.atlas.cell % COLUMNS) * CELL} ${Math.floor(record.atlas.cell / COLUMNS) * CELL} ${CELL} ${CELL}`}>
      <image href={`/charsets/${record.atlas.sheet}`} width={CELL * COLUMNS} height={CELL * COLUMNS} />
    </svg>
  </svg>
{:else if record.glyph}
  <img class="record-glyph" src={`/charsets/${record.glyph}`} alt="" width="128" height="128" decoding="async" />
{/if}

<style>
  .record-glyph{display:block;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;object-fit:contain}
  @media (prefers-color-scheme:dark){:global(:root:not([data-theme='light'])) .record-glyph{filter:invert(1)}}
  :global(:root[data-theme='dark']) .record-glyph{filter:invert(1)}
</style>
