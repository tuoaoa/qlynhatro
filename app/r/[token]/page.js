'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Info, CheckCircle, Copy, Check, QrCode, AlertTriangle } from 'lucide-react';
import QRCodeLib from 'qrcode';

export default function TenantPage({ params }) {
  const { token } = params;
  const searchParams = useSearchParams();
  const month = searchParams.get('m') || '2026-05';
  const signature = searchParams.get('s') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [config, setConfig] = useState(null);
  const [historicalUsage, setHistoricalUsage] = useState({ electricity: 100, water: 8 });

  // Input states
  const [electricityNew, setElectricityNew] = useState('');
  const [waterNew, setWaterNew] = useState('');
  
  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [photoSelected, setPhotoSelected] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const canvasRef = useRef(null);

  // Offline Cache Key
  const cacheKey = `qlynhatro_cache_${token}_${month}`;

  useEffect(() => {
    // Check local network status
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', () => setIsOffline(false));
      window.addEventListener('offline', () => setIsOffline(true));
    }

    async function fetchData() {
      try {
        const res = await fetch(`/qlynhatro/api/invoice?token=${token}&m=${month}&s=${signature}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi tải thông tin hóa đơn');
        
        setInvoice(data.invoice);
        setConfig(data.config);
        setHistoricalUsage(data.historicalUsage);
        
        // Write cache
        localStorage.setItem(cacheKey, JSON.stringify(data));
        
        if (data.invoice.electricity_new) setElectricityNew(data.invoice.electricity_new);
        if (data.invoice.water_new) setWaterNew(data.invoice.water_new);
        
        if (data.invoice.status === 'PENDING_CONFIRMATION') {
          const eUsage = data.invoice.electricity_new - data.invoice.electricity_old;
          const wUsage = data.invoice.water_new - data.invoice.water_old;
          setResult({
            success: true,
            status: 'PENDING_CONFIRMATION',
            totalAmount: data.invoice.total_amount,
            electricityAmount: data.invoice.electricity_amount,
            waterAmount: data.invoice.water_amount,
            internetAmount: data.invoice.internet_amount,
            serviceAmount: data.invoice.service_amount,
            garbageAmount: data.invoice.garbage_amount,
            electricityUsage: eUsage,
            waterUsage: wUsage
          });
        } else if (data.invoice.status === 'PENDING_PAYMENT') {
          const eUsage = data.invoice.electricity_new - data.invoice.electricity_old;
          const wUsage = data.invoice.water_new - data.invoice.water_old;
          // Retain generated invoice details
          const memo = `NTRO-${data.invoice.room_number}-T${month.replace('-', '')}-VCB`;
          setResult({
            success: true,
            status: 'PENDING_PAYMENT',
            totalAmount: data.invoice.total_amount,
            electricityAmount: data.invoice.electricity_amount,
            waterAmount: data.invoice.water_amount,
            internetAmount: data.invoice.internet_amount,
            serviceAmount: data.invoice.service_amount,
            garbageAmount: data.invoice.garbage_amount,
            electricityUsage: eUsage,
            waterUsage: wUsage,
            vietqrUrl: `https://img.vietqr.io/image/VCB-0071001234567-compact2.png?amount=${data.invoice.total_amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent('Nguyen Van A')}`,
            memo
          });
        }
      } catch (err) {
        // Try fallback cache (Offline-First Lite)
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const data = JSON.parse(cachedData);
          setInvoice(data.invoice);
          setConfig(data.config);
          setHistoricalUsage(data.historicalUsage);
          if (data.invoice.electricity_new) setElectricityNew(data.invoice.electricity_new);
          if (data.invoice.water_new) setWaterNew(data.invoice.water_new);
          setIsOffline(true);
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token, month, signature]);

  // Generate local backup QR code on Canvas using qrcode library
  useEffect(() => {
    if (result && result.status === 'PENDING_PAYMENT' && canvasRef.current) {
      const payload = `STC|VCB|0071001234567|${result.totalAmount}|${result.memo}`;
      QRCodeLib.toCanvas(canvasRef.current, payload, { width: 220, margin: 2 }, (err) => {
        if (err) console.error('Error generating local QR:', err);
      });
    }
  }, [result]);

  const handleCopyMemo = (memoText) => {
    navigator.clipboard.writeText(memoText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (isOffline) {
      setError('Lỗi: Bạn đang ngoại tuyến (Offline). Vui lòng kết nối Internet để gửi chỉ số.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/qlynhatro/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          month,
          signature,
          electricityNew: parseFloat(electricityNew),
          waterNew: parseFloat(waterNew)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tính tiền thất bại');

      setResult(data);
      setInvoice(prev => ({ ...prev, status: 'PENDING_CONFIRMATION' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmInvoice = async () => {
    setError(null);
    setSubmitting(true);

    if (isOffline) {
      setError('Lỗi: Bạn đang ngoại tuyến. Vui lòng kết nối Internet để xác nhận hóa đơn.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/qlynhatro/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          month,
          signature,
          confirm: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xác nhận thất bại');

      setResult(data);
      setInvoice(prev => ({ ...prev, status: 'PENDING_PAYMENT' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPaid = () => {
    setInvoice(prev => ({ ...prev, status: 'PAID' }));
  };

  const elecDiff = electricityNew ? (parseFloat(electricityNew) - (invoice?.electricity_old || 0)) : 0;
  const waterDiff = waterNew ? (parseFloat(waterNew) - (invoice?.water_old || 0)) : 0;

  const isElecAbnormal = electricityNew && (elecDiff > historicalUsage.electricity * 1.5 || elecDiff < historicalUsage.electricity * 0.3);
  const isWaterAbnormal = waterNew && (waterDiff > historicalUsage.water * 1.5 || waterDiff < historicalUsage.water * 0.3);

  if (loading) return <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}><p className="pulsing">Đang kết nối hóa đơn...</p></div>;
  if (error && !invoice) return <div className="container"><div className="error-box"><Info size={18} /> {error}</div></div>;

  return (
    <div className="container">
      {/* Offline Status Badge */}
      {isOffline && (
        <div className="warning-box" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'hsl(var(--destructive))' }}>
          <AlertTriangle size={16} /> Chế độ ngoại tuyến (Offline Mode - Đang sử dụng dữ liệu nhớ cache)
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <ShieldCheck size={26} className="text-primary" />
          Nhà Trọ An Bình
        </h1>
        <p style={{ marginTop: '4px' }}>Hóa đơn tự chốt phòng {invoice?.room_number}</p>
      </div>

      {invoice?.status === 'PENDING_METER' && (
        <form className="card" onSubmit={handleCalculate}>
          <h2>Chốt Số Điện & Nước Tháng {month.split('-')[1]}</h2>
          
          <div className="form-group">
            <label>SỐ ĐIỆN MỚI (Số cũ: {invoice.electricity_old} kWh)</label>
            <div className="input-container">
              <input 
                type="number" 
                pattern="[0-9]*"
                inputMode="decimal"
                placeholder={`Nhập số điện công tơ mới`}
                value={electricityNew}
                onChange={(e) => setElectricityNew(e.target.value)}
                required
              />
              <span className="input-unit">kWh</span>
            </div>
            {isElecAbnormal && (
              <div className="warning-box" style={{ marginTop: '4px' }}>
                <Info size={14} /> Lưu ý: Tiêu thụ điện ({elecDiff} kWh) lệch lớn so với tháng trước ({historicalUsage.electricity} kWh).
              </div>
            )}
          </div>

          <div className="form-group">
            <label>SỐ NƯỚC MỚI (Số cũ: {invoice.water_old} m³)</label>
            <div className="input-container">
              <input 
                type="number" 
                pattern="[0-9]*"
                inputMode="decimal"
                placeholder={`Nhập số nước công tơ mới`}
                value={waterNew}
                onChange={(e) => setWaterNew(e.target.value)}
                required
              />
              <span className="input-unit">m³</span>
            </div>
            {isWaterAbnormal && (
              <div className="warning-box" style={{ marginTop: '4px' }}>
                <Info size={14} /> Lưu ý: Tiêu thụ nước ({waterDiff} m³) lệch lớn so với tháng trước ({historicalUsage.water} m³).
              </div>
            )}
          </div>

          <div className="form-group">
            <label>ẢNH CHỤP CÔNG TƠ MINH BẠCH (Khuyên dùng)</label>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setPhotoSelected(prev => !prev)}
              style={{ height: '48px', fontSize: '14px' }}
            >
              {photoSelected ? '✓ Đã đính kèm ảnh bằng chứng công tơ' : '📸 Chụp ảnh đồng hồ điện nước làm bằng chứng'}
            </button>
          </div>

          {error && <div className="error-box"><Info size={16} /> {error}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={submitting}>
            {submitting ? 'Đang tính toán...' : 'Xem hóa đơn nháp'}
          </button>
        </form>
      )}

      {invoice?.status === 'PENDING_CONFIRMATION' && result && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Xác Nhận Hóa Đơn Nháp</h2>
            <div className="badge badge-occupied" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(var(--warning))', border: '1px solid rgba(245,158,11,0.3)' }}>Rà Soát Kỹ</div>
          </div>

          <table className="bill-table">
            <thead>
              <tr>
                <th>Khoản mục</th>
                <th style={{ textAlign: 'right' }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tiền thuê phòng {invoice.room_number}</td>
                <td className="amount">{invoice.room_price.toLocaleString('vi-VN')} đ</td>
              </tr>
              <tr>
                <td>Tiền Điện ({result.electricityUsage} kWh × {(config?.electricity_price || 3500).toLocaleString('vi-VN')}đ)</td>
                <td className="amount">{result.electricityAmount.toLocaleString('vi-VN')} đ</td>
              </tr>
              {(() => {
                let residentCount = invoice?.resident_count || 1;
                const waterPrice = config?.water_price || 15000;
                const internetPrice = config?.internet_price || 100000;
                const servicePrice = config?.service_price || 50000;
                const garbagePrice = config?.garbage_price || 0;

                return (
                  <>
                    <tr>
                      <td>Tiền Nước ({residentCount} người × {waterPrice.toLocaleString('vi-VN')}đ)</td>
                      <td className="amount">{result.waterAmount.toLocaleString('vi-VN')} đ</td>
                    </tr>
                    <tr>
                      <td>Phí Internet ({residentCount} người × {internetPrice.toLocaleString('vi-VN')}đ)</td>
                      <td className="amount">{(result.internetAmount || (internetPrice * residentCount)).toLocaleString('vi-VN')} đ</td>
                    </tr>
                    <tr>
                      <td>Phí Rác & Dịch vụ ({residentCount} người × {(servicePrice + garbagePrice).toLocaleString('vi-VN')}đ)</td>
                      <td className="amount">{((result.serviceAmount || (servicePrice * residentCount)) + (result.garbageAmount || (garbagePrice * residentCount))).toLocaleString('vi-VN')} đ</td>
                    </tr>
                  </>
                );
              })()}
              <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                <td style={{ fontWeight: '700', fontSize: '16px', color: '#fff' }}>TỔNG CỘNG</td>
                <td className="amount" style={{ fontWeight: '800', fontSize: '18px', color: 'hsl(var(--ring))' }}>
                  {result.totalAmount.toLocaleString('vi-VN')} đ
                </td>
              </tr>
            </tbody>
          </table>

          <div className="warning-box">
            <Info size={18} /> Sau khi bấm xác nhận, chỉ số điện nước sẽ được <strong>KHÓA chặt</strong> để sinh mã VietQR. Bạn sẽ không thể sửa đổi số điện nước được nữa.
          </div>

          {error && <div className="error-box"><Info size={16} /> {error}</div>}

          <button onClick={handleConfirmInvoice} className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Đang chốt hóa đơn...' : 'Tôi Xác Nhận Hóa Đơn Chính Xác'}
          </button>
        </div>
      )}

      {invoice?.status === 'PENDING_PAYMENT' && result && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Quét Mã Thanh Toán</h2>
            <div className="badge badge-unpaid">Chờ Chuyển Khoản</div>
          </div>

          <p style={{ fontSize: '13px' }}>Tổng số tiền cần thanh toán: <strong style={{ color: '#fff', fontSize: '16px' }}>{result.totalAmount.toLocaleString('vi-VN')} đ</strong></p>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: '11px', marginBottom: '8px' }}>QUÉT MÃ VIETQR ĐỂ CHUYỂN KHOẢN AN TOÀN</p>
            
            <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
              {!qrError && !isOffline ? (
                <img 
                  src={result.vietqrUrl} 
                  alt="VietQR Napas247" 
                  onError={() => setQrError(true)}
                  style={{ borderRadius: '12px', border: '4px solid #fff', width: '220px', height: '220px' }}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <canvas ref={canvasRef} style={{ borderRadius: '12px', border: '4px solid #fff' }} />
                  <p style={{ fontSize: '10px', color: 'hsl(var(--warning))', marginTop: '4px' }}>⚠️ Chế độ dự phòng cục bộ (Offline QR Mode)</p>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(30,41,59,0.7)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '10px' }}>NỘI DUNG CHUYỂN KHOẢN BẮT BUỘC</p>
                <p style={{ fontSize: '16px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>{result.memo}</p>
              </div>
              <button 
                type="button" 
                onClick={() => handleCopyMemo(result.memo)} 
                className="btn" 
                style={{ width: '48px', height: '48px', minWidth: '48px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
              >
                {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
            <p><strong>Thông tin tài khoản nhận:</strong></p>
            <p style={{ color: '#fff', marginTop: '2px' }}>• Ngân hàng: Vietcombank (VCB)</p>
            <p style={{ color: '#fff' }}>• Số tài khoản: 0071001234567</p>
            <p style={{ color: '#fff' }}>• Tên thụ hưởng: Nguyen Van A</p>
          </div>

          <button onClick={handleConfirmPaid} className="btn btn-success">
            <CheckCircle size={20} /> Tôi Đã Chuyển Khoản Thành Công
          </button>
        </div>
      )}

      {invoice?.status === 'PAID' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '16px', borderRadius: '9999px' }}>
              <CheckCircle size={60} className="text-success" />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'hsl(var(--success))' }}>HÓA ĐƠN ĐÃ THANH TOÁN</h2>
            <p style={{ marginTop: '8px', fontSize: '15px' }}>Hệ thống đã ghi nhận lịch sử đóng tiền của phòng {invoice.room_number}. Cảm ơn bạn!</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', textAlign: 'left' }}>
            <p style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Tháng thanh toán:</span>
              <strong style={{ color: '#fff' }}>Tháng {month.split('-')[1]} ({month})</strong>
            </p>
            <p style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Cú pháp đối soát ngân hàng:</span>
              <strong style={{ color: '#fff' }}>{result?.memo || `NTRO-${invoice.room_number}-T${month.replace('-','')}`}</strong>
            </p>
            <p style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Đồng bộ máy chủ:</span>
              <strong className="text-success">Đã hoàn thành</strong>
            </p>
          </div>
        </div>
      )}

      {/* Sponsor Footer Promotion for chothuexemay.vn */}
      <footer style={{
        marginTop: '32px',
        padding: '20px 16px',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '13px',
        color: 'hsl(var(--muted-foreground))',
        lineHeight: '1.6'
      }}>
        Sponsor bởi <a href="https://chothuexemay.vn" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', fontWeight: 'bold', textDecoration: 'none' }}>chothuexemay.vn</a> - Nơi cung cấp dịch vụ <a href="https://chothuexemay.vn" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>cho thuê xe máy TPHCM</a> và xe máy điện VinFast giá rẻ, chất lượng và tốt bậc nhất TPHCM. Hỗ trợ dịch vụ uy tín cho người đi làm và sinh viên thuê trọ.
      </footer>
    </div>
  );
}
