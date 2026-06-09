import { Prisma } from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import { applicationRepository } from "../repositories/ApplicationRepository.js";
import { matchingScoreService } from "../services/MatchingScoreService.js";

const batchSize = 50;

async function main() {
  let cursor: string | undefined;
  let updated = 0;

  while (true) {
    const applications = await prisma.application.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        vacancyId: true,
        studentProfileId: true,
      },
    });

    if (applications.length === 0) break;

    for (const application of applications) {
      const result = await matchingScoreService.calculateApplicationMatch(
        application.vacancyId,
        application.studentProfileId,
      );
      await applicationRepository.updateMatchResult(
        application.id,
        result.score,
        result as Prisma.InputJsonValue,
      );
      updated += 1;
    }

    cursor = applications.at(-1)?.id;
  }

  console.log(`Application match snapshots refreshed: ${updated}`);
}

main()
  .catch((error) => {
    console.error("Failed to refresh application match snapshots", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
