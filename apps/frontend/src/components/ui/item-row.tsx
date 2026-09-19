import { DATA_DRAGON_BASE_URL } from '../../constants/data-dragon';

const ITEM_SIZE = 22;

type ItemRowProps = {
    items: number[];
    version: string | undefined;
};

/**
 * A player's item build, in Riot's own slot order — empty slots included, drawn as a
 * placeholder rather than skipped, so the row's length always reads as "how many slots",
 * not "how many items". Decorative only (`aria-hidden`): the surrounding text already
 * carries whatever needs to be read out.
 */
export default function ItemRow({ items, version }: Readonly<ItemRowProps>) {
    return (
        <ul className="flex gap-1" aria-hidden="true">
            {items.map((itemId, slot) => (
                // A slot's position is its identity here — Riot's own item order,
                // empty slots included — so the index is a stable, correct key.
                <li key={slot}>
                    {itemId !== 0 && version ? (
                        <img
                            src={`${DATA_DRAGON_BASE_URL}/cdn/${version}/img/item/${itemId}.png`}
                            alt=""
                            width={ITEM_SIZE}
                            height={ITEM_SIZE}
                            className="rounded object-cover"
                        />
                    ) : (
                        <div
                            className="rounded bg-surface-raised"
                            style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
                        />
                    )}
                </li>
            ))}
        </ul>
    );
}
