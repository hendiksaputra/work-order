<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Oitm;
use App\Services\OitmExcelService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OitmController extends Controller
{
    public function __construct(private OitmExcelService $excel) {}

    public function index(Request $request)
    {
        $query = Oitm::query()->orderBy('U_MIS_UnitNo')->orderBy('U_MIS_ModeNo');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('U_MIS_UnitNo', 'like', "%{$search}%")
                    ->orWhere('U_MIS_ModeNo', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function unitNumbers(Request $request)
    {
        $query = Oitm::query()
            ->select('U_MIS_UnitNo')
            ->whereNotNull('U_MIS_UnitNo')
            ->where('U_MIS_UnitNo', '!=', '');

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where('U_MIS_UnitNo', 'like', "%{$search}%");
        }

        $limit = min(max($request->integer('limit', 50), 1), 100);

        $numbers = $query
            ->distinct()
            ->orderBy('U_MIS_UnitNo')
            ->limit($limit)
            ->pluck('U_MIS_UnitNo');

        return response()->json($numbers);
    }

    public function lookup(Request $request)
    {
        $query = Oitm::query()
            ->select('U_MIS_UnitNo', 'U_MIS_ModeNo')
            ->whereNotNull('U_MIS_UnitNo')
            ->where('U_MIS_UnitNo', '!=', '')
            ->whereNotNull('U_MIS_ModeNo')
            ->where('U_MIS_ModeNo', '!=', '');

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('U_MIS_UnitNo', 'like', "%{$search}%")
                    ->orWhere('U_MIS_ModeNo', 'like', "%{$search}%");
            });
        }

        $limit = min(max($request->integer('limit', 50), 1), 100);

        $items = $query
            ->orderBy('U_MIS_UnitNo')
            ->orderBy('U_MIS_ModeNo')
            ->limit($limit)
            ->get();

        return response()->json($items);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'U_MIS_UnitNo' => 'required|string|max:100',
            'U_MIS_ModeNo' => 'required|string|max:255',
        ]);

        $exists = Oitm::where('U_MIS_UnitNo', $data['U_MIS_UnitNo'])
            ->where('U_MIS_ModeNo', $data['U_MIS_ModeNo'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Kombinasi Unit No dan Model sudah terdaftar.',
            ], 422);
        }

        $item = Oitm::create($data);

        return response()->json($item, 201);
    }

    public function update(Request $request, Oitm $oitm)
    {
        $data = $request->validate([
            'U_MIS_UnitNo' => 'sometimes|string|max:100',
            'U_MIS_ModeNo' => 'sometimes|string|max:255',
        ]);

        $unitNo = $data['U_MIS_UnitNo'] ?? $oitm->U_MIS_UnitNo;
        $modeNo = $data['U_MIS_ModeNo'] ?? $oitm->U_MIS_ModeNo;

        $duplicate = Oitm::where('U_MIS_UnitNo', $unitNo)
            ->where('U_MIS_ModeNo', $modeNo)
            ->where('id', '!=', $oitm->id)
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'Kombinasi Unit No dan Model sudah terdaftar.',
            ], 422);
        }

        $oitm->update($data);

        return response()->json($oitm->fresh());
    }

    public function destroy(Oitm $oitm)
    {
        $oitm->delete();

        return response()->json(['message' => 'Data unit dihapus.']);
    }

    public function export(): StreamedResponse
    {
        $content = $this->excel->buildXlsxContent($this->excel->exportRows());
        $filename = 'oitm-unit-'.now()->format('Ymd-His').'.xlsx';

        return response()->streamDownload(
            static function () use ($content) {
                echo $content;
            },
            $filename,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]
        );
    }

    public function template(): StreamedResponse
    {
        $content = $this->excel->buildXlsxContent($this->excel->templateRows());
        $filename = 'template-oitm-unit.xlsx';

        return response()->streamDownload(
            static function () use ($content) {
                echo $content;
            },
            $filename,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]
        );
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|extensions:xlsx,csv|max:5120',
        ]);

        try {
            $result = $this->excel->importFile($request->file('file'));
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $message = "Import selesai: {$result['imported']} data masuk.";
        if ($result['skipped_empty'] > 0) {
            $message .= " {$result['skipped_empty']} baris kosong/tidak lengkap dilewati.";
        }
        if ($result['skipped_duplicate'] > 0) {
            $message .= " {$result['skipped_duplicate']} duplikat dilewati.";
        }

        return response()->json([
            'message' => $message,
            ...$result,
        ]);
    }
}
