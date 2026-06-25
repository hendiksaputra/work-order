<?php

namespace App\Support;

class WorkOrderOperationalStatus
{
    public const OPEN = 'open';

    public const WAIT_MAN_POWER = 'wait_man_power';

    public const READY_TO_START = 'ready_to_start';

    public const IN_PROGRESS = 'in_progress';

    public const WAIT_DECISION = 'wait_decision';

    public const WAITING_PART = 'waiting_part';

    public const WAITING_TOOL = 'waiting_tool';

    public const WAITING_ALAT_ANGKAT = 'waiting_alat_angkat';

    public const WAITING_INSPECTION = 'waiting_inspection';

    public const WAITING_MACHINING = 'waiting_machining';

    public const WAITING_FABRICATION = 'waiting_fabrication';

    public const HOLD = 'hold';

    public const CANCEL = 'cancel';

    public const COMPLETED = 'completed';

    /** Status operasional: WO diverifikasi & ditutup (bukan workflow `closed`). */
    public const VERIFIED_CLOSED = 'verified_closed';

    /** @return list<string> */
    public static function all(): array
    {
        return [
            self::OPEN,
            self::WAIT_MAN_POWER,
            self::READY_TO_START,
            self::IN_PROGRESS,
            self::WAIT_DECISION,
            self::WAITING_PART,
            self::WAITING_TOOL,
            self::WAITING_ALAT_ANGKAT,
            self::WAITING_INSPECTION,
            self::WAITING_MACHINING,
            self::WAITING_FABRICATION,
            self::HOLD,
            self::CANCEL,
            self::COMPLETED,
            self::VERIFIED_CLOSED,
        ];
    }

    /** @return list<string> */
    public static function completionStatuses(): array
    {
        return [
            self::COMPLETED,
            self::VERIFIED_CLOSED,
        ];
    }

    public static function validationRule(): string
    {
        return 'nullable|in:'.implode(',', self::all());
    }

    public static function requiresFullProgress(string $status): bool
    {
        return in_array($status, self::completionStatuses(), true);
    }

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::OPEN => 'OPEN',
            self::WAIT_MAN_POWER => 'WAIT MAN POWER',
            self::READY_TO_START => 'READY TO START',
            self::IN_PROGRESS => 'IN PROGRESS',
            self::WAIT_DECISION => 'WAIT DECISION',
            self::WAITING_PART => 'WAITING PART',
            self::WAITING_TOOL => 'WAITING TOOL',
            self::WAITING_ALAT_ANGKAT => 'WAITING ALAT ANGKAT',
            self::WAITING_INSPECTION => 'WAITING INSPECTION',
            self::WAITING_MACHINING => 'WAITING MACHINING',
            self::WAITING_FABRICATION => 'WAITING FABRICATION',
            self::HOLD => 'HOLD',
            self::CANCEL => 'CANCEL',
            self::COMPLETED => 'COMPLETED',
            self::VERIFIED_CLOSED => 'CLOSED',
        ];
    }

    /** @return array<string, string> */
    public static function descriptions(): array
    {
        return [
            self::OPEN => 'WO baru dibuat dan belum diproses',
            self::WAIT_MAN_POWER => 'WO belum dikerjakan karena manpower belum ditentukan supervisor',
            self::READY_TO_START => 'WO siap dikerjakan',
            self::IN_PROGRESS => 'Pekerjaan sedang berjalan',
            self::WAIT_DECISION => 'Pekerjaan tertunda menunggu keputusan customer / management / engineering',
            self::WAITING_PART => 'Pekerjaan tertunda karena part/material belum tersedia',
            self::WAITING_TOOL => 'Pekerjaan tertunda karena tools belum tersedia',
            self::WAITING_ALAT_ANGKAT => 'Pekerjaan tertunda karena crane/forklift/alat angkat tidak tersedia',
            self::WAITING_INSPECTION => 'Menunggu proses inspeksi/QC/customer',
            self::WAITING_MACHINING => 'Menunggu proses machining',
            self::WAITING_FABRICATION => 'Menunggu proses fabrikasi',
            self::HOLD => 'Pekerjaan dihentikan sementara',
            self::CANCEL => 'Pekerjaan dibatalkan',
            self::COMPLETED => 'Pekerjaan selesai',
            self::VERIFIED_CLOSED => 'WO sudah diverifikasi dan ditutup',
        ];
    }

    /** @return array<string, string> */
    public static function progressHints(): array
    {
        return [
            self::OPEN => 'Progress terhitung 0%',
            self::WAIT_MAN_POWER => 'Tidak berjalan',
            self::READY_TO_START => 'Bisa berjalan',
            self::IN_PROGRESS => 'Progress berjalan',
            self::WAIT_DECISION => 'Progress berhenti',
            self::WAITING_PART => 'Progress berhenti',
            self::WAITING_TOOL => 'Progress berhenti',
            self::WAITING_ALAT_ANGKAT => 'Progress berhenti',
            self::WAITING_INSPECTION => 'Progress berhenti',
            self::WAITING_MACHINING => 'Progress berhenti',
            self::WAITING_FABRICATION => 'Progress berhenti',
            self::HOLD => 'Progress berhenti',
            self::CANCEL => 'Tidak dihitung',
            self::COMPLETED => '100%',
            self::VERIFIED_CLOSED => 'Final',
        ];
    }
}
