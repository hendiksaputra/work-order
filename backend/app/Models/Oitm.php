<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Oitm extends Model
{
    protected $table = 'OITM';

    protected $fillable = [
        'U_MIS_UnitNo',
        'U_MIS_ModeNo',
    ];
}
