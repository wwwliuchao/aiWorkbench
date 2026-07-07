import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

type CountRow = RowDataPacket & {
  count: number;
};

type FavoriteRow = RowDataPacket & {
  asset_id: number;
};

const missingFavoritesTableMessage =
  "asset favorites table is missing. Run db/migrate_asset_favorites.sql first.";

async function favoritesTableExists() {
  const [rows] = await getPool().execute<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = 'asset_favorites'`
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

async function ensureFavoritesTable() {
  if (!(await favoritesTableExists())) {
    throw new Error(missingFavoritesTableMessage);
  }
}

export async function listFavoriteAssetIds(userId: number): Promise<number[]> {
  await ensureFavoritesTable();

  const [rows] = await getPool().execute<FavoriteRow[]>(
    `SELECT af.asset_id
     FROM asset_favorites af
     INNER JOIN assets a ON a.id = af.asset_id AND a.status = 'active'
     INNER JOIN directories d ON d.id = a.directory_id AND d.status = 'active'
     WHERE af.user_id = :userId
     ORDER BY af.created_at DESC, af.id DESC`,
    { userId }
  );

  return rows.map((row) => Number(row.asset_id));
}

export async function addFavoriteAsset(userId: number, assetId: number): Promise<void> {
  await ensureFavoritesTable();

  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO asset_favorites (user_id, asset_id)
     SELECT :userId, a.id
     FROM assets a
     INNER JOIN directories d ON d.id = a.directory_id
     WHERE a.id = :assetId
       AND a.status = 'active'
       AND d.status = 'active'
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
    { userId, assetId }
  );

  if (result.affectedRows === 0) {
    throw new Error("asset not found or inactive");
  }
}

export async function removeFavoriteAsset(userId: number, assetId: number): Promise<void> {
  await ensureFavoritesTable();

  await getPool().execute(
    `DELETE FROM asset_favorites
     WHERE user_id = :userId AND asset_id = :assetId`,
    { userId, assetId }
  );
}
