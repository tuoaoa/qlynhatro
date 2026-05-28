'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  PlusCircle, 
  DollarSign, 
  Check,
  Settings,
  Users,
  Grid,
  FileText,
  CreditCard,
  Plus,
  MapPin,
  ClipboardList
} from 'lucide-react';

export default function LandlordPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Navigation tabs: overview, rooms, tenants, invoices, settings
  const [activeNav, setActiveNav] = useState('overview');

  // Copied token clipboard helpers
  const [copiedToken, setCopiedToken] = useState(null);
  const [copiedBulk, setCopiedBulk] = useState(false);

  // Forms / Actions state
  const [bulkOpening, setBulkOpening] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [assigningTenant, setAssigningTenant] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [sendingBulkZalo, setSendingBulkZalo] = useState(false);

  // Form fields state
  const [settingsForm, setSettingsForm] = useState({
    name: '', address: '', bankName: '', bankAccount: '', bankOwner: '',
    electricityPrice: 3500, waterPrice: 15000, internetPrice: 100000, servicePrice: 50000, garbagePrice: 10000,
    meterCollectStartDay: 25, meterCollectEndDay: 30, autoSendZalo: false
  });
  const [newAreaName, setNewAreaName] = useState('');
  const [newRoomForm, setNewRoomForm] = useState({
    roomNumber: '', areaId: '', price: '', electricityOld: '0', waterOld: '0', notes: ''
  });
  const [newTenantForm, setNewTenantForm] = useState({
    name: '', phone: '', cccd: '', cccdFrontUrl: '', cccdBackUrl: '', notes: ''
  });
  const [newContractForm, setNewContractForm] = useState({
    roomId: '', tenantId: '', rentAmount: '', depositAmount: '', checkInDate: '', billingStartDate: '',
    coTenant1Name: '', coTenant1Phone: '', coTenant1Cccd: '', coTenant1CccdFrontUrl: '', coTenant1CccdBackUrl: '',
    coTenant2Name: '', coTenant2Phone: '', coTenant2Cccd: '', coTenant2CccdFrontUrl: '', coTenant2CccdBackUrl: '',
    equipmentNotes: ''
  });
  const [uploadedEvidenceUrls, setUploadedEvidenceUrls] = useState([]);
  const [zoomImageUrl, setZoomImageUrl] = useState(null); // Click to zoom modal
  const [activeInvoiceSubTab, setActiveInvoiceSubTab] = useState('pending'); // pending, unpaid, paid

  const month = '2026-05'; // Frozen demo month

  async function loadData() {
    try {
      const res = await fetch('/qlynhatro/api/landlord');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi tải dữ liệu chủ nhà');
      
      setData(json);

      // Populate Settings Form fields once loaded
      if (json.property) {
        setSettingsForm({
          name: json.property.name || '',
          address: json.property.address || '',
          bankName: json.property.bank_name || '',
          bankAccount: json.property.bank_account || '',
          bankOwner: json.property.bank_owner || '',
          electricityPrice: json.property.electricity_price || 3500,
          waterPrice: json.property.water_price || 15000,
          internetPrice: json.property.internet_price || 100000,
          servicePrice: json.property.service_price || 50000,
          garbagePrice: json.property.garbage_price || 0,
          meterCollectStartDay: json.property.meter_collect_start_day || 25,
          meterCollectEndDay: json.property.meter_collect_end_day || 30,
          autoSendZalo: json.property.auto_send_zalo === 1
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // React File Upload Helper
  const handleFileUpload = async (file, callback) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/qlynhatro/api/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi tải tệp tin');
      callback(json.url);
    } catch (err) {
      alert('Không thể tải tệp lên: ' + err.message);
    }
  };

  // Post Request Helper
  async function submitAction(payload) {
    const res = await fetch('/qlynhatro/api/landlord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Thao tác thất bại');
    return json;
  }

  // 1. Settings Submit
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await submitAction({
        action: 'save_settings',
        ...settingsForm
      });
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // 2. Create Area Submit
  const handleCreateArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    setCreatingArea(true);
    try {
      if (editingAreaId) {
        const res = await submitAction({
          action: 'edit_area',
          id: editingAreaId,
          name: newAreaName
        });
        setEditingAreaId(null);
        setNewAreaName('');
        alert(res.message);
      } else {
        const res = await submitAction({
          action: 'create_area',
          name: newAreaName
        });
        setNewAreaName('');
        alert(res.message);
      }
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingArea(false);
    }
  };

  const handleDeleteArea = async (areaId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa dãy/tầng này? Tất cả các phòng thuộc dãy/tầng này sẽ được cập nhật sang "-- Chọn khu --" để giữ an toàn dữ liệu.')) {
      return;
    }
    try {
      const res = await submitAction({ action: 'delete_area', id: areaId });
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditArea = (area) => {
    setEditingAreaId(area.id);
    setNewAreaName(area.name);
    // Scroll to the area block
    const areaBlock = document.getElementById('area-form-block');
    if (areaBlock) {
      areaBlock.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBulkSendZalo = async (isReminder = false) => {
    const actionLabel = isReminder ? 'gửi nhắc nhở chốt số' : 'gửi tin nhắn chốt số';
    if (!confirm(`Bạn có chắc chắn muốn ${actionLabel} hàng loạt đến tất cả các phòng đang có hóa đơn chờ chốt số?`)) {
      return;
    }
    setSendingBulkZalo(true);
    try {
      const res = await submitAction({
        action: 'bulk_send_zalo',
        targetMonth: month,
        isReminder
      });
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingBulkZalo(false);
    }
  };

  const handleUpdateInvoiceResidents = async (invoiceId, currentCount, delta) => {
    const newCount = currentCount + delta;
    if (newCount < 1) return;
    try {
      const res = await submitAction({
        action: 'update_invoice_residents',
        invoiceId,
        residentCount: newCount
      });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 3. Create Room Submit
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreatingRoom(true);
    try {
      if (editingRoomId) {
        const res = await submitAction({
          action: 'edit_room',
          id: editingRoomId,
          ...newRoomForm
        });
        setEditingRoomId(null);
        setNewRoomForm({ roomNumber: '', areaId: '', price: '', electricityOld: '0', waterOld: '0', notes: '' });
        alert(res.message);
      } else {
        const res = await submitAction({
          action: 'create_room',
          ...newRoomForm
        });
        setNewRoomForm({ roomNumber: '', areaId: '', price: '', electricityOld: '0', waterOld: '0', notes: '' });
        alert(res.message);
      }
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingRoom(false);
    }
  };

  // 4. Create Tenant Submit
  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setCreatingTenant(true);
    try {
      if (editingTenantId) {
        const res = await submitAction({
          action: 'edit_tenant',
          id: editingTenantId,
          ...newTenantForm
        });
        setEditingTenantId(null);
        setNewTenantForm({ name: '', phone: '', cccd: '', cccdFrontUrl: '', cccdBackUrl: '', notes: '' });
        alert(res.message);
      } else {
        const res = await submitAction({
          action: 'create_tenant',
          ...newTenantForm
        });
        setNewTenantForm({ name: '', phone: '', cccd: '', cccdFrontUrl: '', cccdBackUrl: '', notes: '' });
        alert(res.message);
      }
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingTenant(false);
    }
  };

  // 5. Assign Tenant Contract (Move-in) Submit
  const handleAssignTenant = async (e) => {
    e.preventDefault();
    setAssigningTenant(true);
    try {
      const coTenantsList = [];
      if (newContractForm.coTenant1Name) {
        coTenantsList.push({ 
          name: newContractForm.coTenant1Name, 
          phone: newContractForm.coTenant1Phone || '',
          cccd: newContractForm.coTenant1Cccd || '',
          cccd_front_url: newContractForm.coTenant1CccdFrontUrl || '',
          cccd_back_url: newContractForm.coTenant1CccdBackUrl || ''
        });
      }
      if (newContractForm.coTenant2Name) {
        coTenantsList.push({ 
          name: newContractForm.coTenant2Name, 
          phone: newContractForm.coTenant2Phone || '',
          cccd: newContractForm.coTenant2Cccd || '',
          cccd_front_url: newContractForm.coTenant2CccdFrontUrl || '',
          cccd_back_url: newContractForm.coTenant2CccdBackUrl || ''
        });
      }

      const res = await submitAction({
        action: 'assign_tenant',
        roomId: newContractForm.roomId,
        tenantId: newContractForm.tenantId,
        coTenants: coTenantsList.length > 0 ? coTenantsList : null,
        equipmentNotes: newContractForm.equipmentNotes,
        evidenceUrls: uploadedEvidenceUrls,
        rentAmount: newContractForm.rentAmount,
        depositAmount: newContractForm.depositAmount,
        checkInDate: newContractForm.checkInDate,
        billingStartDate: newContractForm.billingStartDate
      });
      setNewContractForm({ 
        roomId: '', tenantId: '', rentAmount: '', depositAmount: '', checkInDate: '', billingStartDate: '',
        coTenant1Name: '', coTenant1Phone: '', coTenant1Cccd: '', coTenant1CccdFrontUrl: '', coTenant1CccdBackUrl: '',
        coTenant2Name: '', coTenant2Phone: '', coTenant2Cccd: '', coTenant2CccdFrontUrl: '', coTenant2CccdBackUrl: '',
        equipmentNotes: ''
      });
      setUploadedEvidenceUrls([]);
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigningTenant(false);
    }
  };

  // 6. Bulk Monthly Open
  const handleBulkOpenMonth = async () => {
    if (!confirm(`Bạn có chắc chắn muốn khởi tạo kỳ hóa đơn mới hàng loạt cho toàn bộ các phòng đang thuê vào Tháng ${month.split('-')[1]}? Chỉ số cũ sẽ được tự động kế thừa.`)) {
      return;
    }
    setBulkOpening(true);
    try {
      const res = await submitAction({
        action: 'bulk_open',
        targetMonth: month
      });
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkOpening(false);
    }
  };

  // 7. Mark Paid Manually
  const handleMarkPaid = async (invoiceId) => {
    if (!confirm('Bạn có chắc chắn muốn xác nhận đã thu đủ tiền và duyệt Đã trả cho hóa đơn phòng này?')) {
      return;
    }
    setMarkingPaidId(invoiceId);
    try {
      const res = await submitAction({
        action: 'mark_paid',
        invoiceId
      });
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phòng trọ này? Mọi thông tin hợp đồng và hóa đơn liên quan sẽ bị xóa.')) {
      return;
    }
    try {
      const res = await submitAction({ action: 'delete_room', id: roomId });
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khách thuê này?')) {
      return;
    }
    try {
      const res = await submitAction({ action: 'delete_tenant', id: tenantId });
      alert(res.message);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditRoom = (room) => {
    setEditingRoomId(room.id);
    setNewRoomForm({
      roomNumber: room.room_number,
      areaId: room.area_id,
      price: room.price,
      electricityOld: room.electricity_old,
      waterOld: room.water_old,
      notes: room.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditTenant = (tenant) => {
    setEditingTenantId(tenant.id);
    setNewTenantForm({
      name: tenant.name,
      phone: tenant.phone,
      cccd: tenant.cccd || '',
      cccdFrontUrl: tenant.cccd_front_url || '',
      cccdBackUrl: tenant.cccd_back_url || '',
      notes: tenant.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShareZalo = async (roomNumber, tenantName, token, phone, signature) => {
    const link = `${window.location.origin}/qlynhatro/r/${token}?m=${month}&s=${signature}`;
    const message = `Chào bạn ${tenantName}, vui lòng nhấn vào liên kết dưới đây để tự chốt số điện nước phòng ${roomNumber} và nhận mã QR thanh toán tiền phòng tháng ${month.split('-')[1]} nhé: ${link}`;
    
    setCopiedToken(token);
    try {
      const res = await submitAction({
        action: 'send_zalo',
        phone,
        message
      });
      if (res.botSent) {
        alert('Đã gửi tin nhắn tự động qua Zalo Bot thành công!');
      } else {
        alert(`Zalo Bot chưa gửi được tự động (${res.botError}). Mở Zalo để gửi thủ công (Đã copy sẵn tin nhắn vào Clipboard).`);
        navigator.clipboard.writeText(message);
        const zaloUrl = `https://zalo.me/${phone}`;
        window.open(zaloUrl, '_blank');
      }
    } catch (err) {
      navigator.clipboard.writeText(message);
      const zaloUrl = `https://zalo.me/${phone}`;
      window.open(zaloUrl, '_blank');
    }
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleBulkUnpaidReminder = () => {
    if (!data?.unpaid || data.unpaid.length === 0) return;

    let reminderText = `🔔 THÔNG BÁO NHẮC ĐÓNG TIỀN PHÒNG THÁNG ${month.split('-')[1]}:\n\n`;
    data.unpaid.forEach(item => {
      reminderText += `- Phòng ${item.room_number} (${item.tenant_name}): ${item.total_amount.toLocaleString('vi-VN')} đ\n`;
    });
    reminderText += `\nQuý khách vui lòng quét chuyển khoản bằng mã VietQR đính kèm trong link tự chốt số để thanh toán. Cảm ơn!`;

    navigator.clipboard.writeText(reminderText);
    setCopiedBulk(true);
    setTimeout(() => setCopiedBulk(false), 2500);
    alert('Đã soạn mẫu nhắc nợ hàng loạt cho tất cả các phòng chưa nộp tiền vào Clipboard!');
  };

  if (loading) return <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}><p className="pulsing">Đang tải bảng điều khiển chủ trọ...</p></div>;
  if (error) return <div className="container"><div className="error-box"><AlertTriangle size={18} /> {error}</div></div>;

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      {/* Top Brand Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Building2 size={24} className="text-primary" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800' }}>{data?.property?.name || 'Nhà Trọ An Bình'}</h1>
            <p style={{ fontSize: '12px', opacity: 0.6 }}>Quản lý phòng trọ tối giản • Tháng {month.split('-')[1]}</p>
          </div>
        </div>
      </div>

      {/* Overview Tab Content */}
      {activeNav === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.15)', padding: '14px', borderRadius: '12px' }}>
              <p style={{ fontSize: '10px', opacity: 0.7 }}>THỰC THU (ĐÃ NỘP)</p>
              <strong style={{ fontSize: '18px', color: 'hsl(var(--success))', display: 'block', marginTop: '4px' }}>
                {(data?.summary?.collected || 0).toLocaleString('vi-VN')} đ
              </strong>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '14px', borderRadius: '12px' }}>
              <p style={{ fontSize: '10px', opacity: 0.7 }}>TIỀN DỰ KIẾN</p>
              <strong style={{ fontSize: '18px', color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                {(data?.summary?.totalExpected || 0).toLocaleString('vi-VN')} đ
              </strong>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Đã thu tiền:</span>
              <strong>{data?.summary?.paidCount} / {data?.summary?.totalInvoices} hóa đơn ({Math.round(((data?.summary?.paidCount || 0) / (data?.summary?.totalInvoices || 1)) * 100)}%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Tỷ lệ lấp đầy phòng:</span>
              <strong>{data?.rooms?.filter(r => r.room_status === 'OCCUPIED').length} / {data?.rooms?.length || 1} phòng ({Math.round((data?.rooms?.filter(r => r.room_status === 'OCCUPIED').length / (data?.rooms?.length || 1)) * 100)}%)</strong>
            </div>
          </div>

          {/* Action trigger: Open month */}
          <div className="card" style={{ gap: '12px' }}>
            <h2>Khởi tạo kỳ đóng tiền phòng</h2>
            <p style={{ fontSize: '13px', opacity: 0.7 }}>Khởi tạo hóa đơn trống cho toàn bộ phòng có khách thuê để sẵn sàng cho tenant chốt số điện nước.</p>
            <button onClick={handleBulkOpenMonth} className="btn btn-primary" disabled={bulkOpening}>
              <PlusCircle size={16} /> {bulkOpening ? 'Đang mở tháng...' : `Khởi Tạo Hóa Đơn Tháng ${month.split('-')[1]}`}
            </button>
          </div>

          {/* Detailed Financial Category Revenue Stats Card */}
          <div className="card" style={{ gap: '14px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
              <DollarSign size={18} className="text-primary" /> Chi tiết thu chi từng khoản
            </h2>
            <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 8px 0' }}>Bảng phân tích dòng tiền Dự kiến (Expected) và Thực thu (Collected) từng danh mục trong tháng {month.split('-')[1]}:</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: '🏡 Tiền phòng', exp: data?.detailedRevenue?.expected_room, col: data?.detailedRevenue?.collected_room },
                { label: '⚡ Tiền điện', exp: data?.detailedRevenue?.expected_electricity, col: data?.detailedRevenue?.collected_electricity },
                { label: '💧 Tiền nước', exp: data?.detailedRevenue?.expected_water, col: data?.detailedRevenue?.collected_water },
                { label: '🌐 Internet', exp: data?.detailedRevenue?.expected_internet, col: data?.detailedRevenue?.collected_internet },
                { label: '🧹 Dịch vụ phòng', exp: data?.detailedRevenue?.expected_service, col: data?.detailedRevenue?.collected_service },
                { label: '🗑 Phí rác / Khác', exp: data?.detailedRevenue?.expected_garbage, col: data?.detailedRevenue?.collected_garbage }
              ].map((item, idx) => {
                const expVal = item.exp || 0;
                const colVal = item.col || 0;
                const pct = expVal > 0 ? Math.round((colVal / expVal) * 100) : 0;
                return (
                  <div key={idx} style={{ paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#fff' }}>{item.label}</span>
                      <span style={{ color: 'hsl(var(--ring))' }}>{pct}% Thu hồi</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                      <span>Dự kiến: {expVal.toLocaleString('vi-VN')} đ</span>
                      <span style={{ color: colVal > 0 ? '#4caf50' : 'rgba(255,255,255,0.5)' }}>Thực thu: {colVal.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '4px', height: '6px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ 
                        background: pct === 100 ? '#4caf50' : 'hsl(var(--primary))', 
                        width: `${pct}%`, 
                        height: '100%',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room status cells map */}
          <div className="card" style={{ gap: '12px' }}>
            <h2>Sơ đồ phòng nhanh</h2>
            <div className="room-grid">
              {data?.rooms?.map(room => {
                let statusClass = 'vacant';
                let statusText = 'Trống';
                if (room.room_status === 'OCCUPIED') {
                  if (room.invoice_status === 'PENDING_METER') {
                    statusClass = 'occupied';
                    statusText = 'Chờ chốt';
                  } else if (room.invoice_status === 'PENDING_CONFIRMATION') {
                    statusClass = 'occupied';
                    statusText = 'Chờ xác nhận';
                  } else if (room.invoice_status === 'PENDING_PAYMENT') {
                    statusClass = 'unpaid';
                    statusText = 'Chưa trả';
                  } else if (room.invoice_status === 'PAID') {
                    statusClass = 'vacant';
                    statusText = 'Đã trả';
                  }
                } else if (room.room_status === 'MAINTENANCE') {
                  statusClass = 'unpaid';
                  statusText = 'Sửa chữa';
                }
                return (
                  <div key={room.id} className={`room-cell ${statusClass}`}>
                    <span className="room-number">{room.room_number}</span>
                    <span className="room-status-text">{statusText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rooms Tab Content */}
      {activeNav === 'rooms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Create Area block */}
          <div className="card" id="area-form-block" style={{ gap: '16px' }}>
            <h2>{editingAreaId ? 'Chỉnh Sửa Khu Vực / Tầng trọ' : 'Thêm Khu Vực / Tầng trọ'}</h2>
            <form onSubmit={handleCreateArea} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', width: '100%' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Tầng 1, Dãy A, Khu sau..." 
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-secondary" disabled={creatingArea} style={{ width: 'auto', padding: '0 16px', height: '40px' }}>
                  {editingAreaId ? 'Cập nhật' : 'Thêm mới'}
                </button>
                {editingAreaId && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '0 16px', height: '40px' }}
                    onClick={() => {
                      setEditingAreaId(null);
                      setNewAreaName('');
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>

            {/* List of current Areas */}
            {data?.areas?.length > 0 && (
              <div style={{ marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <h3 style={{ fontSize: '13px', marginBottom: '8px', opacity: 0.8 }}>Danh sách dãy / tầng hiện có:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {data.areas.map(area => (
                    <div 
                      key={area.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        background: 'var(--card-hover)', 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        border: '1px solid var(--border)',
                        fontSize: '13px'
                      }}
                    >
                      <span style={{ fontWeight: '500' }}>{area.name}</span>
                      <button 
                        type="button"
                        onClick={() => startEditArea(area)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', padding: '2px', textDecoration: 'underline' }}
                      >
                        Sửa
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDeleteArea(area.id)}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', fontSize: '11px', padding: '2px', textDecoration: 'underline' }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Create Room Form */}
          <form className="card" onSubmit={handleCreateRoom} style={{ gap: '12px' }}>
            <h2>{editingRoomId ? 'Chỉnh Sửa Phòng Trọ' : 'Thêm Phòng Trọ Mới'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Tên / Số phòng</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: A101, P302"
                  value={newRoomForm.roomNumber}
                  onChange={e => setNewRoomForm({...newRoomForm, roomNumber: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Khu vực / Tầng</label>
                <select 
                  value={newRoomForm.areaId} 
                  onChange={e => setNewRoomForm({...newRoomForm, areaId: e.target.value})}
                  required
                >
                  <option value="">-- Chọn khu --</option>
                  {data?.areas?.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Giá thuê tháng (đ)</label>
              <input 
                type="number" 
                placeholder="Ví dụ: 3000000"
                value={newRoomForm.price}
                onChange={e => setNewRoomForm({...newRoomForm, price: e.target.value})}
                required
              />
              {newRoomForm.price && (
                <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                  Định dạng: {parseFloat(newRoomForm.price).toLocaleString('vi-VN')} đ
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Chỉ số điện ban đầu</label>
                <input 
                  type="number" 
                  value={newRoomForm.electricityOld}
                  onChange={e => setNewRoomForm({...newRoomForm, electricityOld: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Chỉ số nước ban đầu</label>
                <input 
                  type="number" 
                  value={newRoomForm.waterOld}
                  onChange={e => setNewRoomForm({...newRoomForm, waterOld: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Ghi chú phòng</label>
              <input 
                type="text" 
                placeholder="Diện tích, đồ đạc bàn giao..."
                value={newRoomForm.notes}
                onChange={e => setNewRoomForm({...newRoomForm, notes: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" disabled={creatingRoom}>
                <PlusCircle size={16} /> {editingRoomId ? 'Cập nhật phòng trọ' : 'Tạo phòng trọ'}
              </button>
              {editingRoomId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingRoomId(null);
                    setNewRoomForm({ roomNumber: '', areaId: '', price: '', electricityOld: '0', waterOld: '0', notes: '' });
                  }} 
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          {/* Rooms Directory List */}
          <div className="card" style={{ gap: '12px' }}>
            <h2>Danh sách phòng trọ</h2>
            {data?.rooms?.map(room => (
              <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <strong style={{ fontSize: '15px', color: '#fff' }}>Phòng {room.room_number}</strong>
                  <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '8px' }}>({room.area_name || 'Không có khu vực'})</span>
                  <p style={{ fontSize: '12px', marginTop: '2px', opacity: 0.7 }}>
                    Giá thuê: <strong>{room.price.toLocaleString('vi-VN')} đ</strong> • Điện cũ: {room.electricity_old} • Nước cũ: {room.water_old}
                  </p>
                  <p style={{ fontSize: '11px', color: 'hsl(var(--primary))', marginTop: '2px' }}>
                    Khách: {room.tenant_name ? `${room.tenant_name} (${room.tenant_phone})` : <em style={{ opacity: 0.5 }}>Chưa có người thuê</em>}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div className={`badge ${room.room_status === 'OCCUPIED' ? 'badge-unpaid' : 'badge-occupied'}`} style={{ fontSize: '11px' }}>
                    {room.room_status === 'OCCUPIED' ? 'Đang thuê' : 'Trống'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => startEditRoom(room)} 
                      className="btn btn-secondary" 
                      style={{ height: '28px', fontSize: '11px', width: 'auto', padding: '0 8px', borderRadius: '6px' }}
                    >
                      Sửa
                    </button>
                    <button 
                      onClick={() => handleDeleteRoom(room.id)} 
                      className="btn btn-secondary" 
                      style={{ height: '28px', fontSize: '11px', width: 'auto', padding: '0 8px', borderRadius: '6px', color: 'hsl(var(--destructive))' }}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tenants Tab Content */}
      {activeNav === 'tenants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Create Tenant Form */}
          <form className="card" onSubmit={handleCreateTenant} style={{ gap: '12px' }}>
            <h2>{editingTenantId ? 'Chỉnh Sửa Khách Thuê' : 'Thêm Khách Thuê Mới'}</h2>
            <div className="form-group">
              <label>Họ và Tên khách thuê</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Nguyễn Văn A"
                value={newTenantForm.name}
                onChange={e => setNewTenantForm({...newTenantForm, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Số điện thoại liên hệ</label>
              <input 
                type="tel" 
                placeholder="Ví dụ: 0912345678"
                value={newTenantForm.phone}
                onChange={e => setNewTenantForm({...newTenantForm, phone: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Số CCCD / CMND</label>
              <input 
                type="text" 
                placeholder="Nhập 12 số CCCD"
                value={newTenantForm.cccd}
                onChange={e => setNewTenantForm({...newTenantForm, cccd: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Ghi chú thêm</label>
              <input 
                type="text" 
                placeholder="Nơi công tác, quê quán, xe cộ..."
                value={newTenantForm.notes}
                onChange={e => setNewTenantForm({...newTenantForm, notes: e.target.value})}
              />
            </div>

            {/* CCCD Front and Back Card Image Upload */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Ảnh Mặt Trước CCCD</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => handleFileUpload(e.target.files[0], url => setNewTenantForm({...newTenantForm, cccdFrontUrl: url}))}
                  style={{ fontSize: '12px' }}
                />
                {newTenantForm.cccdFrontUrl && (
                  <div style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => setZoomImageUrl(newTenantForm.cccdFrontUrl)}>
                    <img src={newTenantForm.cccdFrontUrl} alt="Mặt trước" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Ảnh Mặt Sau CCCD</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => handleFileUpload(e.target.files[0], url => setNewTenantForm({...newTenantForm, cccdBackUrl: url}))}
                  style={{ fontSize: '12px' }}
                />
                {newTenantForm.cccdBackUrl && (
                  <div style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => setZoomImageUrl(newTenantForm.cccdBackUrl)}>
                    <img src={newTenantForm.cccdBackUrl} alt="Mặt sau" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" disabled={creatingTenant}>
                <PlusCircle size={16} /> {editingTenantId ? 'Cập nhật khách thuê' : 'Thêm khách thuê'}
              </button>
              {editingTenantId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingTenantId(null);
                    setNewTenantForm({ name: '', phone: '', cccd: '', notes: '' });
                  }} 
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          {/* Tenants Directory Directory List */}
          <div className="card" style={{ gap: '12px' }}>
            <h2>Danh bạ khách thuê</h2>
            {data?.tenants?.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '16px 0', opacity: 0.5 }}>Chưa có khách thuê nào được tạo.</p>
            ) : (
              data.tenants.map(t => (
                <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#fff' }}>{t.name}</strong>
                      {t.room_number ? (
                        <span className="badge badge-unpaid" style={{ fontSize: '10px', padding: '2px 8px' }}>Phòng {t.room_number}</span>
                      ) : (
                        <span className="badge badge-occupied" style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>Chờ nhận phòng</span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>SĐT: <strong>{t.phone}</strong> • CCCD: {t.cccd || 'Trống'}</p>
                    {t.notes && <p style={{ fontSize: '11px', marginTop: '2px', opacity: 0.5 }}>Ghi chú: {t.notes}</p>}
                    
                    {/* CCCD Front/Back Image thumbnails */}
                    {(t.cccd_front_url || t.cccd_back_url) && (
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        {t.cccd_front_url && (
                          <div style={{ cursor: 'pointer' }} onClick={() => setZoomImageUrl(t.cccd_front_url)}>
                            <span style={{ fontSize: '10px', display: 'block', opacity: 0.6, marginBottom: '2px' }}>Mặt trước CCCD</span>
                            <img src={t.cccd_front_url} alt="Mặt trước" style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          </div>
                        )}
                        {t.cccd_back_url && (
                          <div style={{ cursor: 'pointer' }} onClick={() => setZoomImageUrl(t.cccd_back_url)}>
                            <span style={{ fontSize: '10px', display: 'block', opacity: 0.6, marginBottom: '2px' }}>Mặt sau CCCD</span>
                            <img src={t.cccd_back_url} alt="Mặt sau" style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                    <button 
                      onClick={() => startEditTenant(t)} 
                      className="btn btn-secondary" 
                      style={{ height: '28px', fontSize: '11px', width: 'auto', padding: '0 8px', borderRadius: '6px' }}
                    >
                      Sửa
                    </button>
                    <button 
                      onClick={() => handleDeleteTenant(t.id)} 
                      className="btn btn-secondary" 
                      style={{ height: '28px', fontSize: '11px', width: 'auto', padding: '0 8px', borderRadius: '6px', color: 'hsl(var(--destructive))' }}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Invoices Tab Content */}
      {activeNav === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Automated Bulk Zalo Actions & Collection Progress Card */}
          <div className="card" style={{ gap: '14px', background: 'linear-gradient(135deg, rgba(26, 42, 62, 0.4) 0%, rgba(13, 20, 30, 0.6) 100%)', border: '1px solid var(--border)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: 'hsl(var(--primary))', margin: 0 }}>
              <Send size={18} /> Tiến độ chốt số & Tự động hóa Zalo
            </h2>
            
            <div style={{ background: 'var(--card-hover)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', lineHeight: '1.6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <strong>Khung thời gian chốt sổ:</strong> Ngày <strong>{data?.property?.meter_collect_start_day || 25}</strong> đến ngày <strong>{data?.property?.meter_collect_end_day || 30}</strong> hàng tháng.
                </div>
                <div style={{ 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  background: data?.property?.auto_send_zalo === 1 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(230, 162, 60, 0.2)', 
                  color: data?.property?.auto_send_zalo === 1 ? '#4caf50' : '#e6a23c', 
                  fontWeight: '600'
                }}>
                  {data?.property?.auto_send_zalo === 1 ? 'Zalo Tự Động Bật' : 'Chế độ thủ công'}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7, display: 'block' }}>Chưa chốt số (PENDING)</span>
                  <strong style={{ fontSize: '18px', color: 'hsl(var(--destructive))' }}>
                    {data?.rooms?.filter(r => r.invoice_status === 'PENDING_METER').length || 0} phòng
                  </strong>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7, display: 'block' }}>Đã nộp số / Đã thanh toán</span>
                  <strong style={{ fontSize: '18px', color: '#4caf50' }}>
                    {data?.rooms?.filter(r => r.invoice_status && r.invoice_status !== 'PENDING_METER').length || 0} phòng
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => handleBulkSendZalo(false)}
                disabled={sendingBulkZalo || data?.rooms?.filter(r => r.invoice_status === 'PENDING_METER').length === 0}
                style={{ height: '40px', fontSize: '13px' }}
              >
                {sendingBulkZalo ? 'Đang gửi...' : 'Gửi Zalo Chốt Số Hàng Loạt'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => handleBulkSendZalo(true)}
                disabled={sendingBulkZalo || data?.rooms?.filter(r => r.invoice_status === 'PENDING_METER').length === 0}
                style={{ height: '40px', fontSize: '13px', color: '#e6a23c', border: '1px solid rgba(230,162,60,0.3)' }}
              >
                {sendingBulkZalo ? 'Đang gửi...' : 'Gửi Zalo Nhắc Nhở Chốt Số'}
              </button>
            </div>
          </div>
          {/* Move-in Procedure (Assign Tenant Contract Form) */}
          <form className="card" onSubmit={handleAssignTenant} style={{ gap: '12px' }}>
            <h2>Ký Hợp Đồng & Làm Thủ Tục Nhận Phòng (Move-in)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Phòng còn trống</label>
                <select 
                  value={newContractForm.roomId} 
                  onChange={e => setNewContractForm({...newContractForm, roomId: e.target.value})}
                  required
                >
                  <option value="">-- Chọn phòng trống --</option>
                  {data?.rooms?.filter(r => r.room_status === 'VACANT').map(r => (
                    <option key={r.id} value={r.id}>Phòng {r.room_number} ({r.price.toLocaleString('vi-VN')}đ)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Khách hàng thuê</label>
                <select 
                  value={newContractForm.tenantId} 
                  onChange={e => setNewContractForm({...newContractForm, tenantId: e.target.value})}
                  required
                >
                  <option value="">-- Chọn khách thuê --</option>
                  {data?.tenants?.filter(t => !t.room_id).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Tiền thuê thỏa thuận</label>
                <input 
                  type="number" 
                  placeholder="Ví dụ: 3000000"
                  value={newContractForm.rentAmount}
                  onChange={e => setNewContractForm({...newContractForm, rentAmount: e.target.value})}
                  required
                />
                {newContractForm.rentAmount && (
                  <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                    Định dạng: {parseFloat(newContractForm.rentAmount).toLocaleString('vi-VN')} đ
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Tiền đặt cọc thu (đ)</label>
                <input 
                  type="number" 
                  placeholder="Ví dụ: 3000000"
                  value={newContractForm.depositAmount}
                  onChange={e => setNewContractForm({...newContractForm, depositAmount: e.target.value})}
                />
                {newContractForm.depositAmount && (
                  <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                    Định dạng: {parseFloat(newContractForm.depositAmount).toLocaleString('vi-VN')} đ
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Ngày nhận phòng</label>
                <input 
                  type="date" 
                  value={newContractForm.checkInDate}
                  onChange={e => setNewContractForm({...newContractForm, checkInDate: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ngày tính tiền</label>
                <input 
                  type="date" 
                  value={newContractForm.billingStartDate}
                  onChange={e => setNewContractForm({...newContractForm, billingStartDate: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* co-tenant inputs (optional for 2, 3 occupants) */}
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'hsl(var(--primary))' }}>Khách ở cùng thêm (Không bắt buộc)</label>
              
              {/* Co-Tenant 1 */}
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#fff' }}>👤 Khách ở cùng thứ nhất</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Họ và Tên"
                    value={newContractForm.coTenant1Name || ''}
                    onChange={e => setNewContractForm({...newContractForm, coTenant1Name: e.target.value})}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                  <input 
                    type="tel" 
                    placeholder="Số điện thoại"
                    value={newContractForm.coTenant1Phone || ''}
                    onChange={e => setNewContractForm({...newContractForm, coTenant1Phone: e.target.value})}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="Số CCCD (12 số)"
                    value={newContractForm.coTenant1Cccd || ''}
                    onChange={e => setNewContractForm({...newContractForm, coTenant1Cccd: e.target.value})}
                    style={{ height: '36px', fontSize: '12px' }}
                  />
                  <div>
                    <label style={{ fontSize: '9px', opacity: 0.6, display: 'block', marginBottom: '2px' }}>Mặt trước CCCD</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleFileUpload(e.target.files[0], url => setNewContractForm({...newContractForm, coTenant1CccdFrontUrl: url}))}
                      style={{ fontSize: '10px', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', opacity: 0.6, display: 'block', marginBottom: '2px' }}>Mặt sau CCCD</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleFileUpload(e.target.files[0], url => setNewContractForm({...newContractForm, coTenant1CccdBackUrl: url}))}
                      style={{ fontSize: '10px', width: '100%' }}
                    />
                  </div>
                </div>
                {(newContractForm.coTenant1CccdFrontUrl || newContractForm.coTenant1CccdBackUrl) && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {newContractForm.coTenant1CccdFrontUrl && <img src={newContractForm.coTenant1CccdFrontUrl} alt="Trước 1" onClick={() => setZoomImageUrl(newContractForm.coTenant1CccdFrontUrl)} style={{ width: '60px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} />}
                    {newContractForm.coTenant1CccdBackUrl && <img src={newContractForm.coTenant1CccdBackUrl} alt="Sau 1" onClick={() => setZoomImageUrl(newContractForm.coTenant1CccdBackUrl)} style={{ width: '60px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} />}
                  </div>
                )}
              </div>

              {/* Co-Tenant 2 */}
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#fff' }}>👤 Khách ở cùng thứ hai</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Họ và Tên"
                    value={newContractForm.coTenant2Name || ''}
                    onChange={e => setNewContractForm({...newContractForm, coTenant2Name: e.target.value})}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                  <input 
                    type="tel" 
                    placeholder="Số điện thoại"
                    value={newContractForm.coTenant2Phone || ''}
                    onChange={e => setNewContractForm({...newContractForm, coTenant2Phone: e.target.value})}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="Số CCCD (12 số)"
                    value={newContractForm.coTenant2Cccd || ''}
                    onChange={e => setNewContractForm({...newContractForm, coTenant2Cccd: e.target.value})}
                    style={{ height: '36px', fontSize: '12px' }}
                  />
                  <div>
                    <label style={{ fontSize: '9px', opacity: 0.6, display: 'block', marginBottom: '2px' }}>Mặt trước CCCD</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleFileUpload(e.target.files[0], url => setNewContractForm({...newContractForm, coTenant2CccdFrontUrl: url}))}
                      style={{ fontSize: '10px', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', opacity: 0.6, display: 'block', marginBottom: '2px' }}>Mặt sau CCCD</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleFileUpload(e.target.files[0], url => setNewContractForm({...newContractForm, coTenant2CccdBackUrl: url}))}
                      style={{ fontSize: '10px', width: '100%' }}
                    />
                  </div>
                </div>
                {(newContractForm.coTenant2CccdFrontUrl || newContractForm.coTenant2CccdBackUrl) && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {newContractForm.coTenant2CccdFrontUrl && <img src={newContractForm.coTenant2CccdFrontUrl} alt="Trước 2" onClick={() => setZoomImageUrl(newContractForm.coTenant2CccdFrontUrl)} style={{ width: '60px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} />}
                    {newContractForm.coTenant2CccdBackUrl && <img src={newContractForm.coTenant2CccdBackUrl} alt="Sau 2" onClick={() => setZoomImageUrl(newContractForm.coTenant2CccdBackUrl)} style={{ width: '60px', height: '38px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} />}
                  </div>
                )}
              </div>
            </div>

            {/* Handover state photo/video uploads */}
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'hsl(var(--primary))', marginBottom: '6px', display: 'block' }}>📸 Ảnh / Video bằng chứng bàn giao phòng hiện trạng</label>
              <input 
                type="file" 
                accept="image/*,video/*"
                multiple
                onChange={async e => {
                  const files = Array.from(e.target.files);
                  for (const file of files) {
                    await handleFileUpload(file, url => {
                      setUploadedEvidenceUrls(prev => [...prev, url]);
                    });
                  }
                }}
                style={{ fontSize: '12px' }}
              />
              {uploadedEvidenceUrls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {uploadedEvidenceUrls.map((url, i) => {
                    const isVideo = url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm');
                    return (
                      <div key={i} style={{ position: 'relative', width: '68px', height: '50px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                        {isVideo ? (
                          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <img src={url} alt={`Evidence ${i}`} onClick={() => setZoomImageUrl(url)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                        )}
                        <button 
                          type="button"
                          onClick={() => setUploadedEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'hsl(var(--destructive))', border: 'none', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          X
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Handover Equipment Notes */}
            <div className="form-group">
              <label>Ghi chú bàn giao trang thiết bị</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Bàn giao 1 điều hòa Daikin, 1 tủ lạnh Aqua, 1 giường gỗ..."
                value={newContractForm.equipmentNotes || ''}
                onChange={e => setNewContractForm({...newContractForm, equipmentNotes: e.target.value})}
                style={{ height: '48px', fontSize: '13px' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={assigningTenant}>
              <ClipboardList size={16} /> Ký hợp đồng & Nhận phòng
            </button>
          </form>

          {/* Tab Invoices Categories inside Invoices tab */}
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button 
              type="button"
              onClick={() => setActiveInvoiceSubTab('pending')}
              style={{ 
                flex: 1, 
                height: '36px', 
                border: 'none', 
                borderRadius: '6px', 
                background: activeInvoiceSubTab === 'pending' ? 'hsl(var(--primary))' : 'transparent',
                color: activeInvoiceSubTab === 'pending' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Chưa chốt số ({data?.pendingMeters?.length || 0})
            </button>
            <button 
              type="button"
              onClick={() => setActiveInvoiceSubTab('unpaid')}
              style={{ 
                flex: 1, 
                height: '36px', 
                border: 'none', 
                borderRadius: '6px', 
                background: activeInvoiceSubTab === 'unpaid' ? 'hsl(var(--primary))' : 'transparent',
                color: activeInvoiceSubTab === 'unpaid' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Chưa trả ({data?.unpaid?.length || 0})
            </button>
            <button 
              type="button"
              onClick={() => setActiveInvoiceSubTab('paid')}
              style={{ 
                flex: 1, 
                height: '36px', 
                border: 'none', 
                borderRadius: '6px', 
                background: activeInvoiceSubTab === 'paid' ? 'hsl(var(--primary))' : 'transparent',
                color: activeInvoiceSubTab === 'paid' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Đã trả ({data?.paidInvoices?.length || 0})
            </button>
          </div>

          {/* Sub-tab 1: Pending Meters */}
          {activeInvoiceSubTab === 'pending' && (
            <div className="card" style={{ gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Phòng chưa chốt chỉ số ({data?.pendingMeters?.length || 0})</h2>
              </div>
              {data?.pendingMeters?.length === 0 ? (
                <p style={{ fontSize: '13px', opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>✓ Đã chốt xong chỉ số tất cả các phòng.</p>
              ) : (
                data.pendingMeters.map(item => (
                  <div key={item.invoice_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>Phòng {item.room_number}</h3>
                      <p style={{ fontSize: '12px', opacity: 0.7 }}>Khách: {item.tenant_name} • {item.tenant_phone}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', opacity: 0.9 }}>
                        <span>Số khách ở:</span>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateInvoiceResidents(item.invoice_id, item.resident_count || 1, -1)}
                          style={{ padding: '0 6px', background: 'var(--card-hover)', border: '1px solid var(--border)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <strong style={{ color: 'hsl(var(--primary))', minWidth: '10px', textAlign: 'center' }}>{item.resident_count || 1}</strong>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateInvoiceResidents(item.invoice_id, item.resident_count || 1, 1)}
                          style={{ padding: '0 6px', background: 'var(--card-hover)', border: '1px solid var(--border)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleShareZalo(item.room_number, item.tenant_name, item.access_token, item.tenant_phone, item.signature)}
                      className="btn btn-primary"
                      style={{ height: '36px', fontSize: '12px', width: 'auto', padding: '0 12px' }}
                    >
                      <Send size={12} /> {copiedToken === item.access_token ? 'Đã copy + Mở Zalo' : 'Gửi Zalo'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-tab 2: Unpaid Invoices */}
          {activeInvoiceSubTab === 'unpaid' && (
            <div className="card" style={{ gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Chờ duyệt đóng tiền phòng ({data?.unpaid?.length || 0})</h2>
                {data?.unpaid?.length > 0 && (
                  <button 
                    onClick={handleBulkUnpaidReminder} 
                    className="btn btn-secondary"
                    style={{ width: 'auto', height: '32px', padding: '0 8px', fontSize: '11px' }}
                  >
                    {copiedBulk ? '✓ Đã sao chép' : '🔔 Nhắc nợ hàng loạt'}
                  </button>
                )}
              </div>
              {data?.unpaid?.length === 0 ? (
                <p style={{ fontSize: '13px', opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>✓ Không có hóa đơn nào đang chờ duyệt nộp tiền.</p>
              ) : (
                data.unpaid.map(item => (
                  <div key={item.invoice_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>Phòng {item.room_number}</h3>
                      <p style={{ fontSize: '13px', color: 'hsl(var(--ring))', fontWeight: 'bold' }}>{item.total_amount.toLocaleString('vi-VN')} đ</p>
                      <p style={{ fontSize: '11px', opacity: 0.5 }}>{item.tenant_name} • {item.tenant_phone}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', opacity: 0.9 }}>
                        <span>Số khách ở:</span>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateInvoiceResidents(item.invoice_id, item.resident_count || 1, -1)}
                          style={{ padding: '0 6px', background: 'var(--card-hover)', border: '1px solid var(--border)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <strong style={{ color: 'hsl(var(--primary))', minWidth: '10px', textAlign: 'center' }}>{item.resident_count || 1}</strong>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateInvoiceResidents(item.invoice_id, item.resident_count || 1, 1)}
                          style={{ padding: '0 6px', background: 'var(--card-hover)', border: '1px solid var(--border)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                        >
                          +
                        </button>
                        <span style={{ opacity: 0.5, fontSize: '9px' }}>(Tự tính lại bill)</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleMarkPaid(item.invoice_id)}
                      className="btn btn-success"
                      style={{ height: '36px', fontSize: '12px', width: 'auto', padding: '0 12px' }}
                      disabled={markingPaidId === item.invoice_id}
                    >
                      <Check size={14} /> {markingPaidId === item.invoice_id ? 'Đang duyệt...' : 'Duyệt Đã Trả'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-tab 3: Paid Invoices */}
          {activeInvoiceSubTab === 'paid' && (
            <div className="card" style={{ gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Hóa đơn đã thanh toán ({data?.paidInvoices?.length || 0})</h2>
              </div>
              {data?.paidInvoices?.length === 0 ? (
                <p style={{ fontSize: '13px', opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Không có hóa đơn nào đã thanh toán trong tháng này.</p>
              ) : (
                data.paidInvoices.map(item => (
                  <div key={item.invoice_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', margin: 0 }}>Phòng {item.room_number}</h3>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                          <CheckCircle2 size={10} /> Đã thu tiền
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#4caf50', fontWeight: 'bold', marginTop: '4px', marginBottom: 0 }}>{item.total_amount.toLocaleString('vi-VN')} đ</p>
                      <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '2px', marginBottom: 0 }}>{item.tenant_name} • {item.tenant_phone}</p>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', opacity: 0.6 }}>
                      <span>Ngày thu:</span>
                      <strong style={{ display: 'block', color: '#fff' }}>
                        {item.paid_at ? new Date(item.paid_at).toLocaleDateString('vi-VN') : 'Trực tiếp'}
                      </strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab Content */}
      {activeNav === 'settings' && (
        <form className="card" onSubmit={handleSaveSettings} style={{ gap: '16px' }}>
          <h2>Cấu Hình Thiết Lập Chủ Trọ</h2>
          
          <div className="form-group">
            <label>Tên nhà trọ / Tòa nhà</label>
            <input 
              type="text" 
              value={settingsForm.name}
              onChange={e => setSettingsForm({...settingsForm, name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Địa chỉ nhà trọ</label>
            <input 
              type="text" 
              value={settingsForm.address}
              onChange={e => setSettingsForm({...settingsForm, address: e.target.value})}
              required
            />
          </div>

          {/* Owner Bank details for VietQR generation */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={16} /> Ngân hàng thụ hưởng nhận tiền VietQR
            </h3>
            
            <div className="form-group">
              <label>Tên Ngân hàng (Viết tắt chuẩn NAPAS)</label>
              <input 
                type="text" 
                placeholder="Ví dụ: VCB, MB, Techcombank..."
                value={settingsForm.bankName}
                onChange={e => setSettingsForm({...settingsForm, bankName: e.target.value})}
                required
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Số tài khoản ngân hàng</label>
                <input 
                  type="text" 
                  placeholder="Nhập số tài khoản"
                  value={settingsForm.bankAccount}
                  onChange={e => setSettingsForm({...settingsForm, bankAccount: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tên chủ thụ hưởng (Không dấu)</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: NGUYEN VAN A"
                  value={settingsForm.bankOwner}
                  onChange={e => setSettingsForm({...settingsForm, bankOwner: e.target.value.toUpperCase()})}
                  required
                />
              </div>
            </div>
          </div>

          {/* Default utility fee configurations */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>Đơn giá chi phí dịch vụ mặc định (Tính theo đầu người)</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Giá Điện (đ/kWh)</label>
                <input 
                  type="number" 
                  value={settingsForm.electricityPrice}
                  onChange={e => setSettingsForm({...settingsForm, electricityPrice: parseFloat(e.target.value)})}
                  required
                />
                <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                  Định dạng: {(settingsForm.electricityPrice || 0).toLocaleString('vi-VN')} đ/kWh
                </span>
              </div>
              <div className="form-group">
                <label>Giá Nước (đ/người)</label>
                <input 
                  type="number" 
                  value={settingsForm.waterPrice}
                  onChange={e => setSettingsForm({...settingsForm, waterPrice: parseFloat(e.target.value)})}
                  required
                />
                <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                  Định dạng: {(settingsForm.waterPrice || 0).toLocaleString('vi-VN')} đ/người
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Cước Internet (đ/người)</label>
                <input 
                  type="number" 
                  value={settingsForm.internetPrice}
                  onChange={e => setSettingsForm({...settingsForm, internetPrice: parseFloat(e.target.value)})}
                  required
                />
                <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                  Định dạng: {(settingsForm.internetPrice || 0).toLocaleString('vi-VN')} đ/người
                </span>
              </div>
              <div className="form-group">
                <label>Phí dịch vụ chung (đ/người)</label>
                <input 
                  type="number" 
                  value={settingsForm.servicePrice}
                  onChange={e => setSettingsForm({...settingsForm, servicePrice: parseFloat(e.target.value)})}
                  required
                />
                <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                  Định dạng: {(settingsForm.servicePrice || 0).toLocaleString('vi-VN')} đ/người
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Phí Rác / Vệ sinh mặc định (đ/người)</label>
              <input 
                type="number" 
                value={settingsForm.garbagePrice}
                onChange={e => setSettingsForm({...settingsForm, garbagePrice: parseFloat(e.target.value)})}
                required
              />
              <span style={{ fontSize: '11px', opacity: 0.8, color: 'hsl(var(--primary))', display: 'block', marginTop: '4px' }}>
                Định dạng: {(settingsForm.garbagePrice || 0).toLocaleString('vi-VN')} đ/người
              </span>
            </div>

            <div className="card" style={{ background: 'var(--card-hover)', border: '1px dashed var(--border)', gap: '12px', padding: '16px', marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Send size={16} /> Cấu hình Tự động gửi Zalo Hàng tháng
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Ngày bắt đầu chốt sổ (1-31)</label>
                  <select 
                    value={settingsForm.meterCollectStartDay} 
                    onChange={e => setSettingsForm({...settingsForm, meterCollectStartDay: parseInt(e.target.value)})}
                    required
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>Ngày {day} hàng tháng</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Hạn cuối chốt sổ (1-31)</label>
                  <select 
                    value={settingsForm.meterCollectEndDay} 
                    onChange={e => setSettingsForm({...settingsForm, meterCollectEndDay: parseInt(e.target.value)})}
                    required
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>Ngày {day} hàng tháng</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <input 
                  type="checkbox" 
                  id="autoSendZalo"
                  checked={settingsForm.autoSendZalo}
                  onChange={e => setSettingsForm({...settingsForm, autoSendZalo: e.target.checked})}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="autoSendZalo" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '500', opacity: 0.9 }}>
                  Kích hoạt tự động mở tháng và gửi tin nhắn Zalo chốt số vào ngày bắt đầu
                </label>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={savingSettings}>
            <Settings size={16} /> {savingSettings ? 'Đang lưu cài đặt...' : 'Lưu Tất Cả Cấu Hình Thiết Lập'}
          </button>
        </form>
      )}

      {/* Bottom Sticky Mobile-First Navigation Bar */}
      <div className="bottom-nav">
        <div 
          className={`bottom-nav-item ${activeNav === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveNav('overview')}
        >
          <Grid size={20} />
          <span>Tổng quan</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeNav === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveNav('rooms')}
        >
          <Building2 size={20} />
          <span>Phòng</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeNav === 'tenants' ? 'active' : ''}`}
          onClick={() => setActiveNav('tenants')}
        >
          <Users size={20} />
          <span>Khách</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeNav === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveNav('invoices')}
        >
          <FileText size={20} />
          <span>Hóa đơn</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveNav('settings')}
        >
          <Settings size={20} />
          <span>Cài đặt</span>
        </div>
      </div>

      {/* Click to Zoom Modal Component */}
      {zoomImageUrl && (
        <div 
          onClick={() => setZoomImageUrl(null)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.9)', 
            zIndex: 9999, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: '24px',
            cursor: 'pointer'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img 
              src={zoomImageUrl} 
              alt="Zoomed card" 
              style={{ maxWidth: '100vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} 
            />
            <p style={{ color: '#fff', fontSize: '13px', marginTop: '12px', opacity: 0.8, fontWeight: 'bold' }}>Nhấp bất kỳ đâu để đóng hình ảnh</p>
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
        lineHeight: '1.6',
        marginBottom: '40px'
      }}>
        Sponsor bởi <a href="https://chothuexemay.vn" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', fontWeight: 'bold', textDecoration: 'none' }}>chothuexemay.vn</a> - Nơi cung cấp dịch vụ <a href="https://chothuexemay.vn" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>cho thuê xe máy TPHCM</a> và xe máy điện VinFast giá rẻ, chất lượng và tốt bậc nhất TPHCM. Hỗ trợ dịch vụ uy tín cho người đi làm và sinh viên thuê trọ.
      </footer>
    </div>
  );
}
